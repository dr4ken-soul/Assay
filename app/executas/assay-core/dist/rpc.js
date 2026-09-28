/**
 * JSON-RPC 2.0 transport for the assay-core Executa.
 *
 * One stdin reader serves both directions. Forward requests arrive from the
 * Agent, responses to our reverse calls arrive on the same pipe. Mixing the
 * two readers is the documented cause of hung plugins, so this module owns the
 * single reader and demultiplexes by message shape.
 *
 * stdout carries protocol frames only. Every log line goes to stderr.
 */
import readline from 'node:readline';
/** The wire-level error codes this plugin raises, all from the platform spec. */
export const RPC_ERROR = {
    parse: -32700,
    invalidRequest: -32600,
    methodNotFound: -32601,
    invalidParams: -32602,
    internal: -32603,
    samplingNotNegotiated: -32008,
    samplingNotGranted: -32001,
    samplingInvalidRequest: -32004,
    storageNotGranted: -32021,
    storageInvalidPath: -32027,
};
/** Raised when a reverse call comes back as a JSON-RPC error. */
export class ReverseRpcError extends Error {
    /** Platform error code, for example -32021. */
    code;
    /** Raw error data payload, when the host sent one. */
    data;
    /**
     * Builds a reverse call failure.
     * @param code Platform error code from the protocol reference.
     * @param message Human readable failure, safe to surface to the UI.
     * @param data Optional raw payload from the host.
     */
    constructor(code, message, data) {
        super(message);
        this.name = 'ReverseRpcError';
        this.code = code;
        this.data = data;
    }
}
let nextReverseId = 1;
/** Reverse calls in flight, keyed by the id we sent. */
const pending = new Map();
/** Per-invoke state the reverse calls need, set for the duration of a handler. */
let activeContext = { credentials: {}, invokeId: null, samplingToken: null };
/** Whether the host negotiated v2 and advertised sampling. */
let samplingNegotiated = false;
/** Whether the host advertised APS. */
let storageNegotiated = false;
/**
 * Reads credentials and tokens for the call currently being handled.
 * @returns The active invoke context. Never a module level cache of secrets.
 */
export function currentInvokeContext() {
    return activeContext;
}
/**
 * Whether the host advertised the sampling capability during `initialize`.
 * @returns True when a `sampling/createMessage` reverse call can be attempted.
 */
export function canSample() {
    return samplingNegotiated;
}
/**
 * Whether the host advertised persistent storage during `initialize`.
 * @returns True when `storage/*` reverse calls can be attempted.
 */
export function canUseStorage() {
    return storageNegotiated;
}
/**
 * Writes one JSON-RPC frame to stdout and flushes it.
 *
 * Never call this with anything other than a protocol frame. A stray write
 * breaks the framing and the host kills the plugin.
 * @param frame The complete frame to serialise.
 */
function write(frame) {
    process.stdout.write(`${JSON.stringify(frame)}\n`);
}
/**
 * Sends a reverse call to the host and waits for its matching response.
 * @param method Reverse method name, for example `sampling/createMessage`.
 * @param params Method parameters.
 * @returns The host result payload.
 * @throws ReverseRpcError when the host answers with an error frame.
 */
export async function reverseCall(method, params) {
    const id = nextReverseId++;
    const context = activeContext;
    const payload = {
        jsonrpc: '2.0',
        id,
        method,
        params: { ...params },
    };
    if (context.invokeId)
        payload.invoke_id = context.invokeId;
    if (context.samplingToken && (method === 'sampling/createMessage' || method.startsWith('agent/'))) {
        payload.sampling_token = context.samplingToken;
    }
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            pending.delete(id);
            reject(new ReverseRpcError(RPC_ERROR.internal, `reverse call ${method} timed out after 120s`));
        }, 120_000);
        timer.unref?.();
        pending.set(id, {
            resolve: (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            reject: (reason) => {
                clearTimeout(timer);
                reject(reason);
            },
        });
        try {
            write(payload);
        }
        catch (error) {
            pending.delete(id);
            clearTimeout(timer);
            reject(error instanceof Error ? error : new Error(String(error)));
        }
    });
}
/**
 * Handles one inbound line from the Agent.
 *
 * A frame with a `method` is a forward request. A frame with an `id` and a
 * `result` or `error` is the answer to one of our reverse calls.
 * @param line One LF-delimited line, already trimmed.
 */
function onLine(line) {
    if (!line.trim())
        return;
    let message;
    try {
        message = JSON.parse(line);
    }
    catch {
        write({ jsonrpc: '2.0', id: null, error: { code: RPC_ERROR.parse, message: 'parse error' } });
        return;
    }
    const id = (message.id ?? null);
    const hasMethod = typeof message.method === 'string';
    if (!hasMethod && message.id !== null && message.id !== undefined) {
        const settled = pending.get(message.id);
        if (!settled)
            return;
        const response = message;
        if (response.error) {
            settled.reject(new ReverseRpcError(response.error.code, response.error.message, response.error.data));
        }
        else {
            settled.resolve(response.result);
        }
        return;
    }
    const request = message;
    void handleForward(request);
}
/**
 * Dispatches one forward request and writes the response frame.
 * @param request The inbound request.
 */
async function handleForward(request) {
    const id = request.id;
    if (request.method === 'initialize') {
        const params = (request.params ?? {});
        const hostCapabilities = (params.host_capabilities ?? {});
        samplingNegotiated = hostCapabilities['llm.sample'] === true;
        storageNegotiated = true;
        write({
            jsonrpc: '2.0',
            id,
            result: {
                protocolVersion: '2.0',
                serverInfo: { name: 'assay-core', version: '0.1.0' },
                client_capabilities: { sampling: {}, storage: {} },
                host_capabilities: { 'llm.sample': true, 'aps.kv': true },
            },
        });
        return;
    }
    if (request.method === 'shutdown') {
        write({ jsonrpc: '2.0', id, result: { ok: true } });
        return;
    }
    if (request.method === 'invoke') {
        const params = (request.params ?? {});
        const context = (params.context ?? {});
        // Credentials arrive flat under context.credentials. Some hosts nest them
        // one level deeper, so unwrap that shape rather than reading an empty map.
        const flat = (context.credentials ?? {});
        const nested = (flat.context ?? undefined);
        const source = nested && typeof nested === 'object' ? nested.credentials : flat;
        const credentials = {};
        for (const [name, value] of Object.entries(source ?? {})) {
            if (typeof value === 'string')
                credentials[name] = value;
        }
        activeContext = {
            credentials,
            invokeId: params.invoke_id ?? null,
            samplingToken: params.sampling_token ?? null,
        };
        try {
            const data = await invokeHandler(params, activeContext);
            write({ jsonrpc: '2.0', id, result: data });
        }
        catch (error) {
            const rpcError = error;
            write({
                jsonrpc: '2.0',
                id,
                error: {
                    code: rpcError.code ?? RPC_ERROR.internal,
                    message: rpcError.message ?? 'internal error',
                },
            });
        }
        finally {
            activeContext = { credentials: {}, invokeId: null, samplingToken: null };
        }
        return;
    }
    const params = (request.params ?? {});
    try {
        const result = await forwardHandler(request.method, params);
        write({ jsonrpc: '2.0', id, result });
    }
    catch (error) {
        const failure = error;
        write({
            jsonrpc: '2.0',
            id,
            error: { code: failure.code ?? RPC_ERROR.internal, message: failure.message ?? 'internal error' },
        });
    }
}
/** The `describe` and `health` handler, supplied by `index.ts`. */
let forwardHandler = async (method) => {
    throw Object.assign(new Error(`Method not found: ${method}`), { code: RPC_ERROR.methodNotFound });
};
/**
 * Registers the handler for `describe` and `health`.
 * @param handler The forward handler to install.
 */
export function setForwardHandler(handler) {
    forwardHandler = handler;
}
/** The `invoke` handler, supplied by `index.ts`. */
let invokeHandler = async () => {
    throw Object.assign(new Error('not wired'), { code: RPC_ERROR.internal });
};
/**
 * Registers the handler for `invoke`.
 * @param handler The invoke handler to install.
 */
export function setInvokeHandler(handler) {
    invokeHandler = handler;
}
/**
 * Starts the single stdin reader. Called once at module load by `index.ts`.
 *
 * The process must keep reading until EOF. Exiting after one response breaks
 * every reverse call family.
 */
export function startTransport() {
    const reader = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
    reader.on('line', onLine);
    reader.on('close', () => {
        process.exit(0);
    });
}
/**
 * Writes one diagnostic line to stderr. Never writes to stdout.
 * @param parts Values to join with a single space.
 */
export function logLine(...parts) {
    const safe = parts.map((part) => (typeof part === 'string' ? part : JSON.stringify(part)));
    process.stderr.write(`[assay-core] ${safe.join(' ')}\n`);
}
