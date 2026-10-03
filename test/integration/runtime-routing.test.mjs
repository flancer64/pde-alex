import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {mkdtemp, mkdir, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const project = fileURLToPath(new URL('../../', import.meta.url));

test('Runtime UI bypasses CMS while session checks and CMS rendering remain active', {timeout: 30000}, async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'pde-alex-routing-'));
    let child;
    let exited;
    let log = '';
    const personSecret = randomBytes(48).toString('base64url');
    try {
        for (const name of ['src', 'bootstrap', 'node_modules']) {
            await symlink(path.join(project, name), path.join(root, name), 'dir');
        }
        await writeFile(path.join(root, 'package.json'), await readFile(path.join(project, 'package.json')));
        await writeFile(path.join(root, '.env'), await readFile(path.join(project, '.env.example')));
        await mkdir(path.join(root, 'files'));
        await mkdir(path.join(root, 'tmpl/web/en'), {recursive: true});
        await writeFile(path.join(root, 'tmpl/web/en/template-probe.html'), '<p>CMS template {{ locale }}</p>');
        await writeFile(path.join(root, 'tmpl/web/publication-probe.md'),
            '---\ntitle: CMS probe\ndescription: Routing verification\ndate: "2026-10-03"\n---\n# CMS publication probe\n');

        const listener = createServer();
        listener.listen(0, '127.0.0.1');
        await once(listener, 'listening');
        const port = listener.address().port;
        await new Promise(resolve => listener.close(resolve));
        const base = `http://127.0.0.1:${port}`;
        const env = Object.fromEntries(Object.entries(process.env)
            .filter(([name]) => !name.startsWith('PDE_') && !name.startsWith('TEQFW_') && !name.startsWith('TEQ_CMS__')));
        Object.assign(env, {
            PDE_RUNTIME__PERSON_SECRET: personSecret,
            PDE_RUNTIME__BASE_URL: base,
            PDE_DESK_FILES__ROOT: path.join(root, 'files'),
            PDE_DESK_PORKBUN__API_KEY: 'routing-test-key',
            PDE_DESK_PORKBUN__SECRET_API_KEY: 'routing-test-secret',
            PDE_DESK_TELEGRAM__TDLIB_DIRECTORY: path.join(root, 'telegram'),
            PDE_DESK_WORLD_MAP__STATE_DATA_SOURCE: 'default',
            TEQFW_DB__CLIENT: 'sqlite3',
            TEQFW_DB__FILENAME: path.join(root, 'state.sqlite'),
            TEQFW_WEB__HOST: '127.0.0.1',
            TEQFW_WEB__PORT: String(port),
        });
        child = spawn(process.execPath, [path.join(project, 'node_modules/.bin/teq'),
            '--host', '@flancer32/pde-alex', '--host-root', root, 'web:start'], {env, stdio: ['ignore', 'pipe', 'pipe']});
        exited = once(child, 'exit');
        child.stdout.on('data', chunk => { log += chunk; });
        child.stderr.on('data', chunk => { log += chunk; });
        let ready = false;
        for (let attempt = 0; attempt < 80; attempt++) {
            assert.equal(child.exitCode, null, log);
            try {
                const response = await fetch(`${base}/api/v1/pub/sign-in/person`, {signal: AbortSignal.timeout(1000)});
                ready = response.status === 200;
                await response.arrayBuffer();
                if (ready) break;
            } catch {}
            await delay(100);
        }
        assert.ok(ready, log);

        for (const route of ['/pub/sign-in/', '/pub/sign-in/?return_to=%2Fperson%2Fdashboard',
            '/pub/sign-in/delegate/verify/', '/oauth/select/']) {
            const response = await fetch(base + route, {redirect: 'manual'});
            assert.equal(response.status, 200, route);
            assert.match(response.headers.get('content-type'), /text\/html/, route);
            assert.match(await response.text(), /<!doctype html>/i, route);
        }
        for (const route of ['/assets/css/app.css', '/assets/entry/bootstrap.mjs', '/vendor/teqfw-di/esm.js']) {
            const response = await fetch(base + route);
            assert.equal(response.status, 200, route);
            assert.ok((await response.text()).length > 0);
        }
        for (const route of ['/person/dashboard/', '/delegate/account/']) {
            const response = await fetch(base + route, {redirect: 'manual'});
            assert.equal(response.status, 303, route);
            assert.equal(response.headers.get('location'), '/pub/sign-in/', route);
            await response.arrayBuffer();
        }
        const deskModule = await fetch(`${base}/desk/echo/src/Echo.mjs`, {redirect: 'manual'});
        assert.equal(deskModule.status, 401);
        await deskModule.arrayBuffer();
        const csrfResponse = await fetch(`${base}/api/v1/pub/sign-in/person`);
        const {csrfToken} = await csrfResponse.json();
        const login = await fetch(`${base}/api/v1/pub/sign-in/person`, {
            method: 'POST', headers: {'content-type': 'application/json'},
            body: JSON.stringify({csrf: csrfToken, secret: personSecret}),
        });
        assert.equal(login.status, 200);
        assert.equal((await login.json()).authenticated, true);
        const cookie = login.headers.get('set-cookie').split(';')[0];
        const dashboard = await fetch(`${base}/person/dashboard/`, {headers: {cookie}, redirect: 'manual'});
        assert.equal(dashboard.status, 200);
        assert.match(await dashboard.text(), /<!doctype html>/i);

        const template = await fetch(`${base}/en/template-probe.html`);
        assert.equal(template.status, 200);
        assert.equal(await template.text(), '<p>CMS template en</p>');
        const publication = await fetch(`${base}/publication-probe.md`);
        assert.equal(publication.status, 200);
        assert.match(publication.headers.get('content-type'), /text\/markdown/);
        assert.match(await publication.text(), /CMS publication probe/);
        const missing = await fetch(`${base}/pub/missing/`);
        assert.equal(missing.status, 404);
        await missing.arrayBuffer();
    } finally {
        if (child && child.exitCode === null) {
            child.kill('SIGINT');
            const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
            await exited;
            clearTimeout(timer);
        }
        await rm(root, {recursive: true, force: true});
    }
});
