// Keep worker transform files in one stable writable directory on Windows sandboxes.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
const temp=resolve(".test-tmp");mkdirSync(temp,{recursive:true});
const result=spawnSync(process.execPath,["node_modules/vitest/vitest.mjs","run",...process.argv.slice(2)],{stdio:"inherit",env:{...process.env,TEMP:temp,TMP:temp,TMPDIR:temp}});
if(result.error)throw result.error;process.exit(result.status??1);
