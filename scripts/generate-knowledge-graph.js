import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

/**
 * Knowledge graph generator for EasySupport.
 * Scans source files and produces a standalone interactive D3.js graph HTML file.
 *
 * Nodes: guilds, modules, commands, events, DB tables, categories, statuses, roles, routes, services
 * Edges: contains, triggers, references, uses, configures, serves
 */

function readDirRecursive(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...readDirRecursive(full));
    } else if (entry.name.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

const nodes = new Map();
const edges = new Set();

function addNode(id, label, group) {
  if (!nodes.has(id)) {
    nodes.set(id, { id, label, group });
  }
  return nodes.get(id);
}

function addEdge(source, target, relationship) {
  const key = source + '->' + target + '->' + relationship;
  edges.add({ source, target, relationship, key });
}

// ---- Scan commands ----
const commandFiles = readDirRecursive(path.join(projectRoot, 'bot', 'commands'));
for (const file of commandFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const base = path.basename(file, '.js');

  const nameMatch = content.match(/data:\s*\{\s*name:\s*['"]([^'"]+)['"]/);
  const cmdName = nameMatch ? nameMatch[1] : base;

  addNode('cmd:' + cmdName, cmdName, 'command');
  addEdge('cmd:' + cmdName, 'bot:discord-client', 'triggers');

  const tableRefs = content.match(/(?:FROM|INTO|UPDATE|TABLE)\s+([a-z_]+)/gi);
  if (tableRefs) {
    for (const ref of tableRefs) {
      const tableName = ref.split(/\s+/).pop();
      addNode('db:' + tableName, tableName, 'database-table');
      addEdge('cmd:' + cmdName, 'db:' + tableName, 'uses');
    }
  }

  const eventRefs = content.match(/client\.on\(['"]([^'"]+)['"]/g);
  if (eventRefs) {
    for (const ref of eventRefs) {
      const evtName = ref.match(/['"]([^'"]+)['"]/)[1];
      addNode('evt:' + evtName, evtName, 'event');
      addEdge('evt:' + evtName, 'cmd:' + cmdName, 'triggers');
    }
  }
}

// ---- Scan events ----
const eventFiles = readDirRecursive(path.join(projectRoot, 'bot', 'events'));
for (const file of eventFiles) {
  const content = fs.readFileSync(file, 'utf8');

  const nameMatch = content.match(/name:\s*['"]([^'"]+)['"]/);
  const evtName = nameMatch ? nameMatch[1] : path.basename(file, '.js');

  addNode('evt:' + evtName, evtName, 'event');
  addEdge('evt:' + evtName, 'bot:discord-client', 'listens-to');

  const tableRefs = content.match(/(?:FROM|INTO|UPDATE|TABLE)\s+([a-z_]+)/gi);
  if (tableRefs) {
    for (const ref of tableRefs) {
      const tableName = ref.split(/\s+/).pop();
      addNode('db:' + tableName, tableName, 'database-table');
      addEdge('evt:' + evtName, 'db:' + tableName, 'uses');
    }
  }
}

// ---- Scan db.js for tables ----
const dbContent = fs.readFileSync(path.join(projectRoot, 'shared', 'db.js'), 'utf8');
const createTableMatches = dbContent.match(/CREATE TABLE IF NOT EXISTS ([a-z_]+)/gi);
if (createTableMatches) {
  for (const match of createTableMatches) {
    const tableName = match.split(' ').pop();
    addNode('db:' + tableName, tableName, 'database-table');
    addEdge('shared:db', 'db:' + tableName, 'contains');
  }
}

// ---- Scan categories.js for categories and statuses ----
const catContent = fs.readFileSync(path.join(projectRoot, 'shared', 'categories.js'), 'utf8');

const categoryBlock = catContent.match(/export const CATEGORIES\s*=\s*\{([\s\S]*?)\}/);
if (categoryBlock) {
  const keyMatches = categoryBlock[1].match(/([a-zA-Z_$][\w$]*)\s*:/g);
  if (keyMatches) {
    for (const km of keyMatches) {
      const key = km.replace(':', '').trim();
      addNode('cat:' + key, key, 'category');
      addEdge('shared:categories', 'cat:' + key, 'contains');
    }
  }
}

const statusBlock = catContent.match(/export const TICKET_STATUSES\s*=\s*\{([\s\S]*?)\}/);
if (statusBlock) {
  const keyMatches = statusBlock[1].match(/([a-zA-Z_$][\w$]*)\s*:/g);
  if (keyMatches) {
    for (const km of keyMatches) {
      const key = km.replace(':', '').trim();
      addNode('sts:' + key, key, 'status');
      addEdge('shared:categories', 'sts:' + key, 'defines');
    }
  }
}

// ---- Scan routes for endpoints ----
const routeFiles = readDirRecursive(path.join(projectRoot, 'backend', 'api', 'routes'));
for (const file of routeFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const routeName = path.basename(file, '.js');

  addNode('route:' + routeName, routeName, 'route');
  addEdge('backend:api', 'route:' + routeName, 'serves');

  const routeMatches = content.match(/app\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g);
  if (routeMatches) {
    for (const rm of routeMatches) {
      const m = rm.match(/app\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/);
      const method = m[1].toUpperCase();
      const pathStr = m[2];
      const endpointId = 'ep:' + method + ':' + pathStr;
      addNode(endpointId, method + ' ' + pathStr, 'endpoint');
      addEdge('route:' + routeName, endpointId, 'exposes');
    }
  }
}

// Add system-level nodes
addNode('bot:discord-client', 'Discord Client', 'bot');
addNode('shared:db', 'Database (MySQL)', 'system');
addNode('shared:categories', 'Categories & Statuses', 'system');
addNode('backend:api', 'Express API', 'backend');
addNode('frontend:views', 'EJS Templates', 'frontend');
addNode('frontend:public', 'Static Assets', 'frontend');
addNode('server:entry', 'server.js (entry)', 'system');

// Connect system nodes
addEdge('server:entry', 'backend:api', 'mounts');
addEdge('server:entry', 'bot:discord-client', 'starts');
addEdge('server:entry', 'shared:db', 'connects');
addEdge('backend:api', 'frontend:views', 'renders');
addEdge('backend:api', 'shared:db', 'queries');
addEdge('bot:discord-client', 'shared:db', 'uses');
addEdge('frontend:views', 'frontend:public', 'loads');

// Build graph data
const graph = {
  nodes: Array.from(nodes.values()),
  edges: Array.from(edges).map(function(e) {
    var k = e.key;
    var r = {};
    for (var prop in e) {
      if (prop !== 'key') r[prop] = e[prop];
    }
    return r;
  }),
};

const graphJson = JSON.stringify(graph, null, 2);

// Build HTML with escaped dollar signs for inline JS template literals
const dollar = '$'; // used to escape template literals in the generated HTML
const html = [
'<!DOCTYPE html>',
'<html lang="en">',
'<head>',
'  <meta charset="UTF-8">',
'  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
'  <title>EasySupport — Knowledge Graph</title>',
'  <script src="https://d3js.org/d3.v7.min.js"></script>',
'  <style>',
'    * { box-sizing: border-box; margin: 0; padding: 0; }',
'    body { font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; background: #0f0f0f; color: #e5e5e5; overflow: hidden; }',
'    #graph { width: 100vw; height: 100vh; position: relative; }',
'    .links line { stroke: #333333; stroke-opacity: 0.4; stroke-width: 1.5px; }',
'    .links line:hover { stroke-opacity: 0.8; stroke-width: 3px; }',
'    .nodes circle { stroke: #ffffff; stroke-width: 2px; cursor: pointer; }',
'    .nodes circle:hover { stroke: #7c3aed; stroke-width: 3px; }',
'    .node-label { font-size: 11px; font-weight: 600; pointer-events: none; text-anchor: middle; fill: #e5e5e5; }',
'    .node-label:hover { fill: #7c3aed; }',
'    .legend { position: absolute; top: 20px; left: 20px; background: rgba(15, 15, 15, 0.9); padding: 12px 16px; border-radius: 8px; border: 1px solid #333; font-size: 12px; z-index: 100; }',
'    .legend h2 { margin: 0 0 8px 0; font-size: 16px; color: #7c3aed; }',
'    .legend-item { display: flex; align-items: center; margin: 4px 0; }',
'    .legend-dot { width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; }',
'    .controls { position: absolute; bottom: 20px; right: 20px; background: rgba(15, 15, 15, 0.9); padding: 10px 14px; border-radius: 8px; border: 1px solid #333; z-index: 100; }',
'    .controls button { background: #7c3aed; color: #ffffff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 6px; }',
'    .controls button:hover { background: #a855f7; }',
'    .controls button:last-child { margin-right: 0; background: #333333; }',
'    .controls button:last-child:hover { background: #444444; }',
'    .info { position: absolute; bottom: 20px; left: 20px; background: rgba(15, 15, 15, 0.9); padding: 12px 16px; border-radius: 8px; border: 1px solid #333; font-size: 12px; z-index: 100; max-width: 300px; }',
'    .info h3 { margin: 0 0 6px 0; color: #7c3aed; font-size: 14px; }',
'    .info p { margin: 2px 0; opacity: 0.8; }',
'    .group-command { fill: #7c3aed; }',
'    .group-event { fill: #a855f7; }',
'    .group-category { fill: #3b82f6; }',
'    .group-status { fill: #10b981; }',
'    .group-database-table { fill: #f59e0b; }',
'    .group-route { fill: #ef4444; }',
'    .group-endpoint { fill: #ec4899; }',
'    .group-bot { fill: #8b5cf6; }',
'    .group-system { fill: #64748b; }',
'    .group-backend { fill: #06b6d4; }',
'    .group-frontend { fill: #84cc16; }',
'  </style>',
'</head>',
'<body>',
'  <div class="legend">',
'    <h2>EasySupport Knowledge Graph</h2>',
'    <div class="legend-item"><div class="legend-dot group-command"></div>Commands</div>',
'    <div class="legend-item"><div class="legend-dot group-event"></div>Events</div>',
'    <div class="legend-item"><div class="legend-dot group-category"></div>Categories</div>',
'    <div class="legend-item"><div class="legend-dot group-status"></div>Statuses</div>',
'    <div class="legend-item"><div class="legend-dot group-database-table"></div>DB Tables</div>',
'    <div class="legend-item"><div class="legend-dot group-route"></div>Routes</div>',
'    <div class="legend-item"><div class="legend-dot group-endpoint"></div>Endpoints</div>',
'    <div class="legend-item"><div class="legend-dot group-system"></div>System</div>',
'    <div class="legend-item"><div class="legend-dot group-backend"></div>Backend</div>',
'    <div class="legend-item"><div class="legend-dot group-frontend"></div>Frontend</div>',
'  </div>',
'  <div class="controls">',
'    <button onclick="restart()">Restart layout</button>',
'    <button onclick="togglePause()">Pause/Resume</button>',
'  </div>',
'  <div class="info">',
'    <h3>Graph Stats</h3>',
'    <p>Nodes: <span id="nodeCount">0</span></p>',
'    <p>Edges: <span id="edgeCount">0</span></p>',
'    <p>Single-server architecture</h3>',
'    <p>Backend + Bot + Frontend on one process</p>',
'  </div>',
'  <div id="graph"></div>',
'  <script>',
'    const graphData = ' + graphJson + ';',
'',
'    const width = window.innerWidth;',
'    const height = window.innerHeight;',
'',
'    const svg = d3.select(\'#graph\')',
'      .append(\'svg\')',
'      .attr(\'width\', width)',
'      .attr(\'height\', height);',
'',
'    const g = svg.append(\'g\').attr(\'class\', \'everything\');',
'',
'    const link = g.append(\'g\')',
'      .attr(\'class\', \'links\')',
'      .selectAll(\'line\');',
'',
'    const node = g.append(\'g\')',
'      .attr(\'class\', \'nodes\')',
'      .selectAll(\'g\');',
'',
'    const simulation = d3.forceSimulation(graphData.nodes)',
'      .force(\'link\', d3.forceLink(graphData.edges).id(d => d.id).distance(120))',
'      .force(\'charge\', d3.forceManyBody().strength(-400))',
'      .force(\'center\', d3.forceCenter(width / 2, height / 2))',
'      .force(\'collide\', d3.forceCollide().radius(70));',
'',
'    document.getElementById(\'nodeCount\').textContent = graphData.nodes.length;',
'    document.getElementById(\'edgeCount\').textContent = graphData.edges.length;',
'',
'    let isPaused = false;',
'',
'    function render() {',
'      link = link.data(graphData.edges, function(d) { return d.source.id + \'-\' + d.target.id + \'-\' + d.relationship; });',
'      link.enter()',
'        .append(\'line\')',
'        .attr(\'stroke\', \'#333333\')',
'        .attr(\'stroke-opacity\', 0.4)',
'        .attr(\'stroke-width\', 1.5)',
'        .merge(link)',
'        .attr(\'x1\', function(d) { return d.source.x; })',
'        .attr(\'y1\', function(d) { return d.source.y; })',
'        .attr(\'x2\', function(d) { return d.target.x; })',
'        .attr(\'y2\', function(d) { return d.target.y; });',
'      link.exit().remove();',
'',
'      node = node.data(graphData.nodes, function(d) { return d.id; });',
'      const nodeEnter = node.enter()',
'        .append(\'g\')',
'        .attr(\'class\', \'node\');',
'',
'      nodeEnter.append(\'circle\')',
'        .attr(\'r\', 20)',
'        .attr(\'class\', function(d) { return d.group; })',
'        .attr(\'fill\', function(d) {',
'          const colors = {',
'            \'command\': \'#7c3aed\',',
'            \'event\': \'#a855f7\',',
'            \'category\': \'#3b82f6\',',
'            \'status\': \'#10b981\',',
'            \'database-table\': \'#f59e0b\',',
'            \'route\': \'#ef4444\',',
'            \'endpoint\': \'#ec4899\',',
'            \'bot\': \'#8b5cf6\',',
'            \'system\': \'#64748b\',',
'            \'backend\': \'#06b6d4\',',
'            \'frontend\': \'#84cc16\',',
'          };',
'          return colors[d.group] || \'#64748b\';',
'        });',
'',
'      nodeEnter.append(\'text\')',
'        .attr(\'class\', \'node-label\')',
'        .attr(\'dy\', \'-1.2em\')',
'        .text(function(d) { return d.label; });',
'',
'      nodeEnter.append(\'title\')',
'        .text(function(d) { return d.label + \'\\n\' + d.group; });',
'',
'      node = nodeEnter.merge(node);',
'',
'      node.attr(\'transform\', function(d) { return \'translate(\' + d.x + ,\' + d.y + \')\'; });',
'',
'      simulation.on(\'tick\', function() {',
'        link',
'          .attr(\'x1\', function(d) { return d.source.x; })',
'          .attr(\'y1\', function(d) { return d.source.y; })',
'          .attr(\'x2\', function(d) { return d.target.x; })',
'          .attr(\'y2\', function(d) { return d.target.y; });',
'',
'        node.attr(\'transform\', function(d) { return \'translate(\' + d.x + ,\' + d.y + \')\'; });',
'      });',
'    }',
'',
'    function restart() {',
'      simulation.alpha(1).restart();',
'    }',
'',
'    function togglePause() {',
'      isPaused = !isPaused;',
'      if (isPaused) simulation.stop();',
'      else simulation.restart();',
'    }',
'',
'    render();',
'  </script>',
'</body>',
'</html>',
''].join('\n');

const outputPath = path.join(projectRoot, 'frontend', 'public', 'knowledge-graph.html');
fs.writeFileSync(outputPath, html, 'utf8');

console.log('[knowledge-graph] Generated ' + outputPath);
console.log('[knowledge-graph] Nodes: ' + graph.nodes.length + ', Edges: ' + graph.edges.length);
