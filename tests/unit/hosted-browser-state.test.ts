import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, statSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeHostedStorageState } from '../../scripts/lib/hosted-browser-state.mjs';
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, {recursive:true,force:true}); });
function fixture() {
  const dir=mkdtempSync(join(tmpdir(),'brb-hosted-state-'));dirs.push(dir);
  const path=join(dir,'state.json');writeFileSync(path,'original',{mode:0o600});return {dir,path};
}
const cookie = {domain:'dinkuskit.com',name:'__Secure-dk-merchant.session_token',secure:true,value:'synthetic-test-value',expires:200};
describe('operator hosted state preservation',()=>{
  it.each([
    {cookies:[]}, {cookies:[{...cookie,domain:'stripe.com'}]},
    {cookies:[{...cookie,expires:99}]}, {cookies:[{...cookie,value:''}]},
    {cookies:[{...cookie,name:'other_cookie'}]}, {cookies:[{...cookie,secure:false}]},
  ])('refuses an unrelated or missing owner session without touching the prior state',state=>{
    const {path,dir}=fixture();expect(()=>writeHostedStorageState(state,path,100)).toThrow('existing file left unchanged');
    expect(readFileSync(path,'utf8')).toBe('original');expect(readdirSync(dir)).toEqual(['state.json']);
  });
  it.each(['dinkuskit.com','.dinkuskit.com'])('atomically saves a qualifying %s session privately',domain=>{
    const {path,dir}=fixture();const state={cookies:[{...cookie,domain}],origins:[]};
    writeHostedStorageState(state,path,100);expect(JSON.parse(readFileSync(path,'utf8'))).toEqual(state);
    expect(statSync(path).mode&0o777).toBe(0o600);expect(readdirSync(dir)).toEqual(['state.json']);
  });
});
