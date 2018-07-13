import { UnboundRule, MatchFunction } from "../../engine/rule";
import { PatternMatch } from "../../match";
import { ITargetExec } from "../../engine/interfaces";

export class RuleBase {
	kind: string;
	match: MatchFunction;
	protected _exec: UnboundRule;

	constructor(kind: string, pattern: string | MatchFunction) {
		this.kind = kind;
		this.match = pattern instanceof Function ? pattern : PatternMatch(pattern);
	}
}

export class UserRule extends RuleBase {
	constructor(kind: string, pattern: string | MatchFunction) {
		super(kind, pattern);
	}
	def(fn: UnboundRule) {
		this._exec = fn;
		return this;
	}
	exec(target: ITargetExec, ...m: string[]) {
		return this._exec(target, ...m);
	}
}
