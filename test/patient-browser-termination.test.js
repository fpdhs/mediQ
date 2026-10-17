import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {patientBrowserHasTerminated} from '../scripts/lib/patient-browser-integration.js';

test('browser termination includes exit zero, nonzero and signal; unknown or live is not terminal',()=>{
  for(const value of [undefined,{}, {exitCode:null,signalCode:null},{exitCode:undefined,signalCode:undefined}])assert.equal(patientBrowserHasTerminated(value),false);
  for(const value of [{exitCode:0,signalCode:null},{exitCode:1,signalCode:null},{exitCode:null,signalCode:'SIGTERM'}])assert.equal(patientBrowserHasTerminated(value),true);
});

test('signal termination of an owned child is observed rather than waiting for numeric exitCode',{timeout:10000},async()=>{
  const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true});
  try{
    await once(child,'spawn');assert.equal(patientBrowserHasTerminated(child),false);
    const closed=once(child,'close');child.kill('SIGTERM');await closed;
    assert.equal(patientBrowserHasTerminated(child),true);
  }finally{if(!patientBrowserHasTerminated(child))child.kill('SIGTERM');}
});
