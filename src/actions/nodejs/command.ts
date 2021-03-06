import * as cp from "child_process";
import * as os from "os";
import * as path from "path";

import { ProcessActionOptions } from "../command";
import { ActionEnv } from "../interfaces";
import { IpcMessage } from "../../ipc";

const memorySize = Math.round(os.totalmem() / 1048576);

function nodejsExitPromise(p: cp.ChildProcess, returnValue: () => any, err: () => any) {
	return new Promise<any>(function (resolve, reject) {
		p.on("exit", function (code, signal) {
			const e = err();
			const r = returnValue();
			if (signal || code || e) {
				return reject(e);
			} else {
				return resolve(r);
			}
		});
	});
}

function startNodeJSCallPromise(
	module: string,
	modulePath: string,
	args: any[],
	options: ProcessActionOptions
) {
	let returnValue: string | null = null;
	let errorThrown: Error | null = null;
	let proc = cp.spawn(
		process.execPath,
		["--max-old-space-size=" + memorySize, path.join(__dirname, "nodejs-call-process.js")],
		{
			cwd: options.cwd,
			env: options.env,
			stdio: ["pipe", "pipe", "pipe", "ipc"],
		}
	);

	if (options.reporter) {
		options.reporter.actions([[module, ...args]], "jsCall");
	}

	proc.on("message", function (message: IpcMessage) {
		if (!message.directive) {
			errorThrown = new Error("IPC Error " + message);
		}
		switch (message.directive) {
			case "ready":
				proc.send({ directive: "load", path: modulePath });
				break;
			case "loaded":
				proc.send({ directive: "call", args: args });
				break;
			case "return":
				returnValue = message.result;
				proc.send({ directive: "over" });
				break;
			case "error":
				errorThrown = new Error(message.reason);
				break;
			case "callError":
				errorThrown = new Error(message.message || message.reason);
				break;
			default:
				errorThrown = new Error("<IPC Error> " + message);
				break;
		}
	});

	if (options.reporter) {
		if (proc.stdout) proc.stdout.on("data", (data) => options.reporter.redirectStdout(data));
		if (proc.stderr) proc.stderr.on("data", (data) => options.reporter.redirectStderr(data));
	}

	return nodejsExitPromise(
		proc,
		() => returnValue,
		() => errorThrown
	);
}

export function createKit_NodeJS(ce: ActionEnv) {
	function runNodeJS(module: string, ...args: any[]): Promise<any> {
		return startNodeJSCallPromise(module, path.resolve(ce.cd, module), args, {
			cwd: ce.cd,
			env: ce.env,
			reporter: ce.reporter,
		});
	}

	return {
		node: runNodeJS,
	};
}
