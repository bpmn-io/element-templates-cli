import { expect } from 'chai';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { downloadTemplate } from '../src/downloadTemplate.js';

describe('downloadTemplate', function() {

  it('should download the latest version when no version specified', async function() {

    // given
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'etc-dl-'));
    const templateV2 = { id: 'com.example.Conn', name: 'My Connector', version: 2 };
    const templateV1 = { id: 'com.example.Conn', name: 'My Connector', version: 1 };

    const routes = {};
    const { url, close } = await serveJson(routes);
    routes['/index.json'] = {
      'com.example.Conn': [
        { version: 2, ref: `${url}/template-v2.json`, engine: {} },
        { version: 1, ref: `${url}/template-v1.json`, engine: {} }
      ]
    };
    routes['/template-v2.json'] = templateV2;
    routes['/template-v1.json'] = templateV1;

    try {

      // when
      const result = await downloadTemplate('com.example.Conn', {
        cacheDir: tmpRoot,
        marketplaceUrl: `${url}/index.json`
      });

      // then
      expect(result.id).to.eql('com.example.Conn');
      expect(result.version).to.eql(2);
      const written = JSON.parse(await fs.readFile(result.file, 'utf8'));
      expect(written).to.deep.equal(templateV2);
    } finally {
      await close();
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });


  it('should download a specific version', async function() {

    // given
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'etc-dl-'));
    const templateV1 = { id: 'com.example.Conn', name: 'My Connector', version: 1 };

    const routes = {};
    const { url, close } = await serveJson(routes);
    routes['/index.json'] = {
      'com.example.Conn': [
        { version: 2, ref: `${url}/template-v2.json`, engine: {} },
        { version: 1, ref: `${url}/template-v1.json`, engine: {} }
      ]
    };
    routes['/template-v2.json'] = { id: 'com.example.Conn', version: 2 };
    routes['/template-v1.json'] = templateV1;

    try {

      // when
      const result = await downloadTemplate('com.example.Conn', {
        version: 1,
        cacheDir: tmpRoot,
        marketplaceUrl: `${url}/index.json`
      });

      // then
      expect(result.version).to.eql(1);
      const written = JSON.parse(await fs.readFile(result.file, 'utf8'));
      expect(written).to.deep.equal(templateV1);
    } finally {
      await close();
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });


  it('should throw when id is not in the index', async function() {

    // given
    const routes = {};
    const { url, close } = await serveJson(routes);
    routes['/index.json'] = { 'com.example.Other': [] };

    try {
      await downloadTemplate('com.example.Missing', {
        marketplaceUrl: `${url}/index.json`
      });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err.message).to.include('com.example.Missing');
    } finally {
      await close();
    }
  });


  it('should throw when requested version is not available', async function() {

    // given
    const routes = {};
    const { url, close } = await serveJson(routes);
    routes['/index.json'] = {
      'com.example.Conn': [
        { version: 2, ref: `${url}/template-v2.json`, engine: {} }
      ]
    };

    try {
      await downloadTemplate('com.example.Conn', {
        version: 99,
        marketplaceUrl: `${url}/index.json`
      });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err.message).to.include('99');
      expect(err.message).to.include('Available');
    } finally {
      await close();
    }
  });
});


function serveJson(routes) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const body = routes[req.url];
      if (body === undefined) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const url = `http://127.0.0.1:${port}`;
      const close = () => new Promise((res, rej) => server.close(err => err ? rej(err) : res()));
      resolve({ url, close });
    });

    server.on('error', reject);
  });
}
