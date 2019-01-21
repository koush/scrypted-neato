import "core-js/modules/es6.promise";

var botvac = require('node-botvac');
var client = new botvac.Client();

function Neato(robot) {
    this.robot = robot;
}

Neato.prototype.isPausable = function () {
    return true;
}

Neato.prototype.isRunning = function () {
    return true;
}

Neato.prototype.isPaused = function () {
    return true;
}

Neato.prototype.start = function () {
    this.robot.getState(function (error, result) {
        this.robot.startCleaning(function (data) {
        });
    }.bind(this));
}

Neato.prototype.dock = function () {
    this.robot.getState(function (error, result) {
        this.robot.sendToBase(function (data) {
        });
    }.bind(this));
}

Neato.prototype.pause = function () {
    this.robot.getState(function (error, result) {
        this.robot.pauseCleaning(function (data) {
        });
    }.bind(this));
}

Neato.prototype.stop = function () {
    this.robot.getState(function (error, result) {
        this.robot.stopCleaning(function (data) {
        });
    }.bind(this));
}

Neato.prototype.resume = function () {
    this.robot.getState(function (error, result) {
        this.robot.resumeCleaning(function (data) {
        });
    }.bind(this));
}

function DeviceProvider() {
};

DeviceProvider.prototype.getDevice = function (id) {
    var robot = this.robots && this.robots[id];
    if (robot)
        return new Neato(robot);
}

DeviceProvider.prototype.updateRobots = function (robots) {
    this.robots = {};
    for (var robot of robots) {
        this.robots[robot._serial] = robot;
    }

    var devices = robots.map(robot => {
        return {
            name: robot.name,
            id: robot._serial,
            interfaces: ['StartStop', 'Dock'],
            type: 'Vacuum',
        }
    })

    log.i(`found robots: ${JSON.stringify(devices)}`);

    deviceManager.onDevicesChanged({
        devices
    });
}

DeviceProvider.prototype.getOauthUrl = function() {
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

DeviceProvider.prototype.onOauthCallback = function(callbackUrl) {
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

    scriptSettings.putString('token', token);
    setClientToken(token);
    getRobots();
}

var deviceProvider = new DeviceProvider();

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

        deviceProvider.updateRobots(validRobots);
    });
}

const username = scriptSettings.getString('username');
const password = scriptSettings.getString('password');
const token = scriptSettings.getString('token');
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

export default deviceProvider;