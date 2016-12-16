"use strict";
let _ = require("underscore");

const tapes = 3;

const keep = '*'.repeat(tapes) + '-'.repeat(tapes);

function str_with(str, index, newChar) {
	return _.map(str, (x, i) => i !== index ? x : newChar).join("");
}

function cond(pattern, ...tape) {
	if (pattern.length !== tape.length || tape.length > tapes)
		throw "ill-formed cond";

	let ans = '*'.repeat(tapes);
	_.each(_.zip(pattern, tape), x => {
		ans = str_with(ans, x[1]-1, x[0]);
	});

	return ans;
}

function move(direction, tape) {
	return str_with(keep, tapes + tape-1, direction);
}

const left = tape => move('<', tape);
const right = tape => move('>', tape);

function write(symbol, tape) {
	return str_with(keep, tape-1, symbol);
}

const erase = tape => write('_', tape);

function symbol_at(symbol, tape) {
	return str_with('*'.repeat(tapes), tape-1, symbol);
}

function all_n(n) {
	if (n == 0)
		return [""];
	const first = _.map(all_n(n-1), x => '_' + x);
	const secnd = _.map(all_n(n-1), x => 'I' + x);
	return _.union(first, secnd);
};

const all = all_n(tapes);

function commas(cond) {
	return cond.split("").join(', ');
}

function action(intent, cond) {
	let ans = "";
	for (let i = 0; i < intent.length; ++i)
		ans += intent[i] !== '*' ? intent[i] : cond[i];
	return commas(ans);
}

function any(from, intent, to) {
	let ans = "";
	_.each(all, (cond) => {
		ans += `${from}, ${commas(cond)}\n${to}, ${action(intent, cond)}\n\n`;
	});
	return ans + '\n';
}

function match(cond, pattern) {
	for (let i = 0; i < pattern.length; ++i)
		if (!(pattern[i] === '*' || cond[i] === pattern[i]))
			return false;
	return true;
}

function multimatch(cond, patterns) {
	for (let i = 0; i < patterns.length; ++i)
		if (match(cond, patterns[i]))
			return i;
}


function if_else(from, pattern, to_true, to_false) {
	let ans = "";
	_.each(all, (cond) => {
		ans += `${from}, ${commas(cond)}\n${match(cond, pattern) ?
				to_true : to_false}, ${action(keep, cond)}\n\n`;
	});
	return ans + '\n';
}

function multiway(from, ...pattern_to) {
	const len = pattern_to.length;
	if (len % 2 === 0)
		throw "ill-formed multiway";

	let patterns = _.filter(pattern_to, (x, i) => i % 2 === 0 && i !== len-1);
	patterns.push('*'.repeat(tapes));
	const to = _.filter(pattern_to, (x, i) => i % 2 === 1 || i === len-1);

	let ans = "";
	_.each(all, (cond) => {
		ans += `${from}, ${commas(cond)}\n${to[multimatch(cond, patterns)]
				}, ${action(keep, cond)}\n\n`;
	});
	return ans + '\n';
}

//const if_else = multiway;

let autoincrement = 0;
/*
function expand(from, subroutine, to) {
	if (!subroutine.match(','))
		throw "empty subroutine??";

	let expanded = subroutine.replace(/q/g, `s${autoincrement++}q`);
	expanded = expanded.replace(/rt/g, to);

	let qEntry = "";
	for (let i = 0; expanded[i] !== ','; ++i)
		qEntry += expanded[i];
	return any(from, keep, qEntry) + expanded;
}
*/
function expand_multi(from, subroutine, ...to) {
	if (!subroutine.match(','))
		throw "empty subroutine??";

	let expanded = subroutine.replace(/q/g, `s${autoincrement++}q`);
	expanded = expanded.replace(/rt(\d*)/g, (_, i) => to[+i]);

	const qEntry = /[^,]*/.exec(expanded);

	return any(from, keep, qEntry) + expanded;
}

const expand = expand_multi;

function ctrl_move(direction, tape) {
	let sub = "";
	sub += any('q0', move(direction, tape), 'q1');
	sub += if_else('q1', symbol_at('I', tape), 'q2', 'rt');
	sub += any('q2', move(direction, tape), 'q1');
	return sub;
}

const prev = tape => ctrl_move('<', tape);
const next = tape => ctrl_move('>', tape);

function copy(src, dst) {
	let sub = "";
	sub += any('q0', right(dst), 'q1');
	sub += any('q1', left(src), 'q2');
	sub += if_else('q2', symbol_at('I', src), 'q3', 'q6');
	sub += any('q3', write('I', dst), 'q4');
	sub += any('q4', right(dst), 'q5');
	sub += any('q5', keep, 'q1');
	sub += expand('q6', next(src), 'rt');
	return sub;
}

function erase_word(tape) {
	let sub = "";
	sub += any('q0', left(tape), 'q1');
	sub += if_else('q1', symbol_at('I', tape), 'q2', 'rt');
	sub += any('q2', erase(tape), 'q3');
	sub += any('q3', left(tape), 'q1');
	return sub;
}

function sum(tape) {
	let sub = "";
	sub += any('q0', left(tape), 'q1');
	sub += if_else('q1', symbol_at('I', tape), 'q2', 'rt');
	sub += any('q2', erase(tape), 'q3');
	sub += expand('q3', prev(tape), 'q4');
	sub += any('q4', write('I', tape), 'q5');
	sub += expand('q5', next(tape), 'rt');
	return sub;
}

function multiply(tape, iter, cnst) {
	let sub = "";
	sub += expand('q0', copy(tape, iter), 'q1');
	sub += expand('q1', copy(tape, cnst), 'q2');
	sub += any('q2', left(iter), 'q3');
	sub += any('q3', left(cnst), 'q4');
	sub += if_else('q4', symbol_at('I', iter), 'q5', 'q16');
	sub += any('q5', erase(iter), 'q6');
	sub += any('q6', right(cnst), 'q7');
	sub += expand('q7', erase_word(tape), 'q8');
	sub += expand('q8', copy(cnst, tape), 'q9');
	sub += any('q9', left(tape), 'q10');
	sub += any('q10', erase(tape), 'q11');
	sub += expand('q11', prev(tape), 'q12');
	sub += any('q12', write('I', tape), 'q13');
	sub += expand('q13', next(tape), 'q14');
	sub += any('q14', left(iter), 'q15');
	sub += if_else('q15', symbol_at('I', iter), 'q17', 'rt');
	sub += any('q17', erase(iter), 'q8');
	sub += any('q16', erase(tape), 'rt');
	return sub;
}

function multiply2(tape, iter, cnst) {
	let sub = "";
	sub += expand('q0', copy(tape, iter), 'q1');
	sub += expand('q1', erase_word(tape), 'q2');
	sub += expand('q2', copy(tape, cnst), 'q3');
	sub += expand('q3', erase_word(tape), 'q4');
	sub += any('q4', right(tape), 'q5');
	sub += any('q5', left(iter), 'q6');
	sub += if_else('q6', symbol_at('I', iter), 'q7', 'q10');
	sub += any('q7', erase(iter), 'q8');
	sub += expand('q8', copy(cnst, tape), 'q9');
	sub += expand('q9', sum(tape), 'q5');
	sub += expand('q10', erase_word(cnst), 'rt');
	return sub;
}

function exp(tape, iter, cnst) {
	let sub = "";
	sub += expand('q0', copy(tape, iter), 'q1');
	sub += expand('q1', erase_word(tape), 'q2');
	sub += expand('q2', copy(tape, cnst), 'q3');
	sub += expand('q3', erase_word(tape), 'q4');
	sub += any('q4', right(tape), 'q41');
	sub += any('q41', write('I', tape), 'q42');
	sub += any('q42', right(tape), 'q5');
	sub += any('q5', left(iter), 'q6');
	sub += if_else('q6', symbol_at('I', iter), 'q7', 'q10');
	sub += any('q7', erase(iter), 'q8');
	sub += expand('q8', copy(cnst, tape), 'q9');
	sub += expand('q9', multiply2(tape, iter, cnst), 'q5');
	sub += expand('q10', erase_word(cnst), 'rt');
	return sub;
}

function cmp(tape, tmp) {
	let sub = "";
	sub += expand('q0', copy(tape, tmp), 'q1');
	sub += expand('q1', erase_word(tape), 'q2');
	sub += any('q2', left(tape), 'q3');
	sub += any('q3', left(tmp), 'q4');
	sub += multiway('q4', cond('II', tape, tmp), 'q5',
			              cond('_I', tape, tmp), 'q10',
			              cond('I_', tape, tmp), 'q12',
			               		                 'rt1');
	sub += any('q5', erase(tape), 'q6');
	sub += any('q6', erase(tmp), 'q2');
	sub += any('q10', right(tmp), 'q20');
	sub += any('q12', right(tape), 'q22');
	sub += expand('q20', erase_word(tmp), 'rt0');
	sub += expand('q22', erase_word(tape), 'rt2');
	return sub;
}
/*
function log(tape, iter, cnst) {
	let sub = "";
	sub += expand('q0', copy(tape, cnst), 'q1');
	sub += expand('q1', erase_word(tape), 'q15');
	sub += any('q15', right(tape), 'q16');
	sub += expand('q16', exp(tape, iter, cnst), 'q2');
	sub += expand('q2', copy(cnst, tape), 'q3');
	sub += expand('q3', cmp(tape, cnst), 'q5', 'rt', 'q9');
	sub += expand('q5', erase_word(tape), 'q6');
	sub += any('q6', write('I', iter), 'q7');
	sub += any('q7', right(iter), 'q75');
	sub += expand('q75', copy(cnst, tape), 'q8');
	sub += expand('q8', copy(iter, tape), 'q16');
	sub += any('q9', left(tape), 'q10');
	sub += any('q10', erase(tape), 'rt');
	return sub;
}
*/

function log2(tape, iter, cnst) {
	let sub = "";
	sub += expand('q0', copy(tape, cnst), 'q1');
	sub += expand('q1', erase_word(tape), 'q14');
	sub += expand('q14', copy(tape, cnst), 'q15');
	sub += any('q15', right(tape), 'q16');
	sub += expand('q16', exp(tape, iter, cnst), 'q2');
	sub += expand('q2', prev(cnst), 'q25');
	sub += expand('q25', copy(cnst, tape), 'q3');
	sub += expand('q3', next(cnst), 'q35');
	sub += expand('q35', cmp(tape, cnst), 'q5', 'q100', 'q9');
	sub += expand('q5', erase_word(tape), 'q6');
	sub += any('q6', write('I', iter), 'q7');
	sub += any('q7', right(iter), 'q75');
	sub += expand('q75', copy(cnst, tape), 'q8');
	sub += expand('q8', copy(iter, tape), 'q16');
	sub += any('q9', left(iter), 'q10');
	sub += any('q10', erase(iter), 'q100');
	sub += expand('q100', erase_word(tape), 'q101');
	sub += expand('q101', copy(iter, tape), 'q102');
	sub += expand('q102', erase_word(iter), 'q103');
	sub += expand('q103', erase_word(cnst), 'q104');
	sub += expand('q104', erase_word(cnst), 'rt');
	return sub;
}

function program(name, subroutine, param_count) {
	let ans = `name: ${name}\ninit: q0\naccept: rt\n\n`;
	for (let i = 0; i < param_count; ++i)
		ans += expand(`q${i}`, next(1), `q${i+1}`);
	ans += expand(`q${param_count}`, subroutine, 'rt');
	return ans;
}
/*
let main = "";
main += expand('q0', cmp(1, 2), 'q1', 'q2', 'q3');
main += any('q1', write('<', 1), 'rt');
main += any('q2', write('=', 1), 'rt');
main += any('q3', write('>', 1), 'rt');
*/

let main = "";
main += expand('q0', log2(1, 2, 3), 'rt');
//main += expand('q0', exp(1, 2, 3), 'rt');

const compiled = program('log v15', main, 2);

console.log(compiled);

require("copy-paste").copy(compiled);