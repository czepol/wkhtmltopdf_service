var fs = require('fs');
var path = require('path')
var http = require('http');
var url = require('url');
var querystring = require('querystring');
var child_process = require('child_process');

var absolutize_html = require('./lib/absolutize_html').absolutize_html;

var host = '0.0.0.0';
var port = process.env.PORT || 8779;

var wkhtmltopdf = 'wkhtmltopdf' // command to execute
// var wkhtmltopdf = 'xvfb-run --server-args="-screen 0, 1024x768x24" wkhtmltopdf';
var documentation = fs.readFileSync(path.join(__dirname, 'Readme.md'));

function splitOptions(options) {
  if (options) {
    return options.split(' ');
  } else {
    return [];
  }
}

function optionsFromEnv() {
  return splitOptions(process.env.WKHTMLTOPDF_DEFAULT_OPTIONS);
}

function optionsFromParams(params) {
  var allowed = splitOptions(process.env.WKHTMLTOPDF_ALLOWED_OPTIONS);
  var options = [];
  allowed.forEach(function(option) {
    if (params[option]) {
      options.push(option, params[option]);
    } else if (params[option] === '') {
      options.push(option);
    }
  });
  return options;
}

function handleHtmlToPdf(html, params, res) {
  var args = optionsFromEnv().concat(optionsFromParams(params), ['-', '-']);
  var io_options = {stdio: ['pipe', 'pipe', process.stderr]};
  var child = child_process.spawn(wkhtmltopdf, args, io_options);
  var buffers = [];
  child.stdout.on('data', function(data) { buffers.push(data) });
  child.on('close', function(code) {
    if (code === 0) {
      var buffer = Buffer.concat(buffers);
      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': buffer.length,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(buffer);
    } else {
      console.log('Error while running wkhtmltopdf: Error ' + code);
      res.writeHead(500, {'Content-Type': 'text/plain'});
      res.end('Error while running wkhtmltopdf');
    }
  });
  child.stdin.on('error', function() { });
  child.stdin.end(html);
}

exports.server = http.createServer(function (req, res) {
  u = url.parse(req.url, true);
  
  if (u.pathname == '/') {
    if (req.method == 'GET') {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end(documentation);
    } else {
      res.writeHead(405, {'Content-Type': 'text/plain'});
      res.end('Only GET method allowed');
    }
  } else if (u.pathname == '/pdf') {
    if (req.method == 'POST') {
      var body = '';
      req.on('data', function(data) { body += data });
      req.on('end', function() {
        var post = querystring.parse(body);
        var html = post.html;
        var url = post.url;
        if (html) {
          if (url) {
            html = absolutize_html(html, url);
          }
          handleHtmlToPdf(html, post, res);
        } else {
          res.writeHead(400, {'Content-Type': 'text/plain'});
          res.end('Form parameter "html" required');
        }
      });
    } else if (req.method == 'GET' && u.query.hasOwnProperty('url')) {
        var _url = u.query.url;
        
        var html = '';
        
        html = absolutize_html(html, _url);
        //handleHtmlToPdf(html, {}, res);
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end(html);
    } else {
      res.writeHead(405, {'Content-Type': 'text/plain'});
      res.end('Only POST method allowed');
    }
  } else {
    res.writeHead(404, {'Content-Type': 'text/plain'});
    res.end('Not found');
  }
}).listen(port, host);

console.log('Listening on http://'+host+':'+port);

