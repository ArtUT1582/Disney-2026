/* Exercise the worker with a small cache/fetch harness, including offline failures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const handlers = {}, stores = new Map(), deleted = [];
let offline = false, failed = new Set();
const key = value => typeof value === 'string' ? new URL(value,'https://example.com/trip/').href : value.url;
function response(body) { return {ok:true,status:200,type:'basic',body,clone(){return response(this.body);}}; }
const caches = {
  async open(name) {
    if (!stores.has(name)) stores.set(name,new Map());
    const store=stores.get(name);
    return {async match(value){return store.get(key(value));}, async put(value,result){store.set(key(value),result);},
      async add(value){const url=key(value); if(offline || failed.has(url)) throw Error('offline'); store.set(url,response(url));}};
  },
  async keys(){return Array.from(stores.keys());},
  async delete(name){deleted.push(name);return stores.delete(name);}
};
const self = {location:{origin:'https://example.com'}, registration:{scope:'https://example.com/trip/'},
  addEventListener(name,callback){handlers[name]=callback;}, async skipWaiting(){}, clients:{async claim(){}}};
vm.runInNewContext(fs.readFileSync(__dirname+'/sw.js','utf8'), {self,caches,URL,Response,Date,
  fetch: async req => {const url=key(req); if(offline || failed.has(url)) throw Error('offline'); return response(url);}});
async function lifecycle(name){let promise;handlers[name]({waitUntil(p){promise=p;}});await promise;}
async function navigation(path){let promise;handlers.fetch({request:{url:'https://example.com/trip/'+path,method:'GET',mode:'navigate',headers:{get(){return 'text/html';}}},respondWith(p){promise=p;}});return await promise;}
async function prepare(core,extras=[]){let promise,result;handlers.message({data:{type:'prepare-offline',core,extras},ports:[{postMessage(value){result=value;}}],waitUntil(p){promise=p;}});await promise;return result;}
(async()=>{
  stores.set('another-app',new Map());stores.set('disney2026-v12',new Map());
  await lifecycle('install');await lifecycle('activate');assert.deepEqual(deleted,['disney2026-v12']);
  await navigation('index.html');await navigation('install-guide.html');offline=true;
  assert.match((await navigation('index.html')).body,/index.html$/);
  assert.match((await navigation('install-guide.html')).body,/install-guide.html$/);
  assert.equal((await navigation('missing.html')).status,503);
  const versioned='https://example.com/trip/day-metrics.js?v=abc';
  assert.equal((await prepare([versioned])).ready,false);
  offline=false;assert.equal((await prepare([versioned])).ready,true);
  offline=true;assert.equal((await prepare([versioned])).ready,true);
  assert.equal((await prepare(['https://outside.example/private'])).ready,false);
  offline=false;failed.add('https://example.com/trip/photo.jpg');
  const partial=await prepare([versioned],['https://example.com/trip/photo.jpg']);
  assert.equal(partial.ready,true);assert.equal(partial.failedExtras,1);
  assert.equal((await prepare(['https://example.com/trip/day-metrics.js?v=new'])).ready,true);
  console.log('Offline regressions passed: versioned assets, isolated pages, missing-file failure, partial photos, scoped cache cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1;});
