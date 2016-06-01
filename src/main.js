const log    = require('./config/logger');
const init   = require('./init');
const shdrcollection = require('./shdrcollection');
const xmltojson = require('./xmltojson');
const egress = require('./egress');
const Client = require('node-ssdp').Client // Control Point
const loki   = require('lokijs');
const util   = require('util');
const net    = require('net');
const fs = require('fs');

var xml = fs.readFileSync('../svc-agent-reader/test/checkfiles/Devices2di.xml','utf8');
var jsonobj = xmltojson.xmltojson(xml);
var xmlschema = xmltojson.insertschematoDB(jsonobj);

var agent = new Client();

var db = new loki('agent-loki.json');
var devices = db.addCollection('devices');

// TODO Global list of active sockets

agent.on('response', function inResponse(headers, code, rinfo) {
    // TODO Handle CACHE-CONTROL

    var headerData = JSON.stringify(headers, null, '  ');
    var data = JSON.parse(headerData);
    var location = data['LOCATION'].split(':');

    var found = devices.find( {'address': location[0], 'port': location[1]} );

    var insert = (found == false) ? devices.insert( { 'address' : location[0], 'port' : location[1] } ) : false ;
});

// Search for interested devices
setInterval(function() {
    agent.search('urn:schemas-upnp-org:service:VMC-3Axis:1');
}, 10000);

// TODO For each device in lokijs, create a socket and connect to it.
// Search for interested devices
setInterval(function() {
    var activeDevices = devices.find({});

    log.debug(util.inspect(activeDevices));

    for (var obj of activeDevices) {
        var client = new net.Socket();

        client.connect(obj.port, obj.address, function() {
            console.log('Connected.');
        });

        client.on('data', function(data) {
            console.log('Received: ' + data);
            //console.log(typeof(data))
            var shdr = shdrcollection.shdrparsing(data.toString());
            var inserteddata = shdrcollection.datacollectionupdate(shdr);
         });

        client.on('close', function() {
	      console.log('Connection closed');
        });
    }
}, 30000);
