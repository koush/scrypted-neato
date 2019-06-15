import sdk from '@scrypted/sdk';
import {ScryptedDeviceBase} from '@scrypted/sdk';

var botvac = require('node-botvac');
var client = new botvac.Client();

const {deviceManager, log} = sdk;

class Neato extends ScryptedDeviceBase {
    constructor(nativeId, robot, events) {
        super(nativeId);
        this.robot = robot;
        this.events = events;

        this.refresher = (err, data) => {
            log.d(data);
            this.refresh();
        }
    }

    refresh(refreshInterface, userInitiated) {
        this._refresh();
    }

    _refresh(cb) {
        this.robot.getState((error, state) => {
            this.log.d(JSON.stringify(state));
            this.running = (state && state.state != 1) || false
            this.docked =  (state && state.details && state.details.isDocked) || false;
            this.paused = (state && state.state == 3) || false;
            this.batteryLevel = (state && state.details && state.details.charge) || 0;

            if (cb) {
                cb();
            }
        })
    }

    isPausable() {
        return true;
    }

    start() {
        this._refresh(() => this.robot.startCleaning(this.refresher));
    }

    dock() {
        this._refresh(() => this.robot.sendToBase(this.refresher));
    }

    pause() {
        this._refresh(() => this.robot.pauseCleaning(this.refresher));
    }

    stop() {
        this._refresh(() => this.robot.stopCleaning(this.refresher));
    }

    resume() {
        this._refresh(() => this.robot.resumeCleaning(this.refresher));
    }
}


function NeatoController() {
}

NeatoController.prototype.getDevice = function (id) {
    return this.robots && this.robots[id];
}

NeatoController.prototype.updateRobots = function (robots) {
    var interfaces = ['StartStop', 'Dock', 'Battery'];
    var events = interfaces.slice();

    interfaces.push('Refresh');

    this.robots = {};
    for (var robot of robots) {
        this.robots[robot._serial] = new Neato(robot._serial, robot, events);
    }

    var devices = robots.map(robot => {
        return {
            name: robot.name,
            nativeId: robot._serial,
            interfaces: interfaces,
            events: events,
            type: 'Vacuum',
        }
    })

    log.i(`found robots: ${JSON.stringify(devices)}`);

    deviceManager.onDevicesChanged({
        devices
    });
}

NeatoController.prototype.getOauthUrl = function () {
    var options = {
        clientId: '44f85521f7730c9f213f25f5e36f080d1e274414f6138ff23fab614faa34fd22',
        scopes: 'control_robots+maps',
        redirectUrl: 'https://home.scrypted.app/oauth/callback'
    }
    var url = "https://apps.neatorobotics.com/oauth2/authorize?client_id=" + options["clientId"] + "&scope=" + options["scopes"] + "&response_type=token&redirect_uri=" + options["redirectUrl"];

    return url;
}

function setClientToken(token) {
    client._token = token;
    client._tokenType = 'Bearer ';
}

NeatoController.prototype.onOauthCallback = function (callbackUrl) {
    var params = callbackUrl.split('#')[1].split("&");

    var token;
    var authError;
    var authErrorDescription;
    params.forEach((item, index) => {
        var key = item.split("=")[0] || "";
        var value = item.split("=")[1] || "";

        if (key.localeCompare("access_token") == 0) {
            token = value;
        }
        else if (key.localeCompare("error") == 0) {
            authError = value;
        }
        else if (key.localeCompare("error_description") == 0) {
            authErrorDescription = value.replace(/\+/g, " ");
        }
    });

    if (authError) {
        log.a(`There was an error logging in with Neato: ${authError} ${authErrorDescription}`);
        return;
    }

    localStorage.getItem('token', token);
    setClientToken(token);
    getRobots();
}

var neatoController = new NeatoController();

//authorize

function getRobots() {
    log.clearAlerts();
    //get your robots
    client.getRobots(function (error, robots) {
        if (error) {
            log.a(`Error retrieving Neato robots: ${error}`);
            throw error;
        }
        log.clearAlerts();

        var validRobots = robots
            .filter(robot => robot._serial && robot._secret);

        neatoController.updateRobots(validRobots);
    });
}

const username = localStorage.getItem('username');
const password = localStorage.getItem('password');
const token = localStorage.getItem('token');
if (token) {
    setClientToken(token);
    getRobots();
}
else if (username && password) {
    log.clearAlerts();
    client.authorize(username, password, false, function (error) {
        if (error) {
            log.a(`Error authorizing with Neato servers: ${error}`);
            throw error;
        }

        getRobots();
    });
}
else {
    log.a('You must provide "username" and "password" values in your Script Settings or use the Authorize button to Log in with Neato.');
}

export default neatoController;