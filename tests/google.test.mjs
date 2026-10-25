import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarApi, tokenClient, CALENDAR_SCOPE } from '../src/google.ts';
test('GIS requests only the approved scope, without incremental grants', () => {
 let config; globalThis.window = { google: { accounts: { oauth2: { initTokenClient(c) { config = c; return { requestAccessToken() {} }; } } } } };
 tokenClient('public-client', () => {}, () => {});
 assert.equal(config.scope, CALENDAR_SCOPE); assert.equal(config.include_granted_scopes, false);
});
test('Calendar request sends bearer in header and disables caching', async () => {
 const original = globalThis.fetch;
 try { globalThis.fetch = async (url, options) => {
 assert.equal(url, 'https://www.googleapis.com/calendar/v3/calendars');
 assert.equal(options.headers.Authorization, 'Bearer mock'); assert.equal(options.cache, 'no-store');
 assert.equal(options.credentials, 'omit'); assert.equal(JSON.parse(options.body).summary, 'Roster');
 return new Response(JSON.stringify({id:'test'}));
 }; assert.deepEqual(await calendarApi('/calendars', 'mock', 'POST', {summary:'Roster'}), {id:'test'});
 } finally { globalThis.fetch = original; }
});
test('API errors surface status and Google detail', async () => {
 const original = globalThis.fetch;
 try { globalThis.fetch = async () => new Response(JSON.stringify({error:{message:'Denied'}}), {status:403});
 await assert.rejects(calendarApi('/calendars', 'mock'), /HTTP 403: Denied/);
 } finally { globalThis.fetch = original; }
});

import {CALENDAR_AUTH_SCOPES,CALENDAR_LIST_SCOPE,scopeGranted,calendarListGranted}from'../src/google.ts';
test('the normal app explicitly requests only app-created event access plus read-only calendar listing',()=>{let config;globalThis.window={google:{accounts:{oauth2:{initTokenClient(c){config=c;return{requestAccessToken(){}};}}}}};tokenClient('public',()=>{},()=>{},CALENDAR_AUTH_SCOPES);assert.deepEqual(new Set(config.scope.split(' ')),new Set([CALENDAR_SCOPE,CALENDAR_LIST_SCOPE]));assert.equal(config.include_granted_scopes,false);});
test('declining optional list access does not claim that it was granted',()=>{globalThis.window={google:{accounts:{oauth2:{hasGrantedAllScopes(response,...scopes){return scopes.every(s=>(response.scope||'').split(' ').includes(s));}}}}};const response={scope:CALENDAR_SCOPE};assert.equal(scopeGranted(response),true);assert.equal(calendarListGranted(response),false);});
