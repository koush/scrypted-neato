import "core-js/modules/es6.promise";

var botvac = require('node-botvac');
var client = new botvac.Client();

function Neato(robot, events) {
    this.robot = robot;
    this.events = events;

    this.refresher = (err, data) => {
        log.d(data);
        this.refresh();
    }
}

const States = {
    StartStop: function (s) {
        return (s && s.state != 1) || false;
    },
    Dock: function(s) {
        return (s && s.details && s.details.isDocked) || false;
    },
    Battery: function(s) {
        return (s && s.details && s.details.charge) || 0;
    }
}

Neato.prototype.refresh = function (cb) {
    this.robot.getState((error, state) => {
        if (state) {
            log.d(JSON.stringify(state));
            var oldState = this.state;
            this.state = state;

            if (oldState) {
                for (var stateGetter of this.events) {
                    var newValue = States[stateGetter](state);
                    // don't bother detecting if the state has not changed. denoising will be done
                    // at the platform level. this is also necessary for external calls to
                    // listen for set events, even if nothing has changed.
                    deviceManager.onDeviceEvent(this.robot._serial, stateGetter, newValue)
                }
            }
        }
        if (cb) {
            cb();
        }
    })
}

Neato.prototype.isPausable = function () {
    return true;
}

Neato.prototype.isRunning = function () {
    return States.StartStop(this.state);
}

Neato.prototype.isPaused = function () {
    return this.state && this.state.state == 3;
}

Neato.prototype.isDocked = function () {
    return States.Dock(this.state);
}

Neato.prototype.getBatteryLevel = function () {
    return States.Battery(this.state);
}

Neato.prototype.start = function () {
    this.refresh(() => this.robot.startCleaning(this.refresher));
}

Neato.prototype.dock = function () {
    this.refresh(() => this.robot.sendToBase(this.refresher));
}

Neato.prototype.pause = function () {
    this.refresh(() => this.robot.pauseCleaning(this.refresher));
}

Neato.prototype.stop = function () {
    this.refresh(() => this.robot.stopCleaning(this.refresher));
}

Neato.prototype.resume = function () {
    this.refresh(() => this.robot.resumeCleaning(this.refresher));
}

function DeviceProvider() {
}

DeviceProvider.prototype.getDevice = function (id) {
    return this.robots && this.robots[id];
}

DeviceProvider.prototype.updateRobots = function (robots) {
    var interfaces = ['StartStop', 'Dock', 'Battery'];
    var events = interfaces.slice();

    interfaces.push('Refresh');

    this.robots = {};
    for (var robot of robots) {
        this.robots[robot._serial] = new Neato(robot, events);
    }

    var devices = robots.map(robot => {
        return {
            name: robot.name,
            id: robot._serial,
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

DeviceProvider.prototype.getOauthUrl = function () {
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

DeviceProvider.prototype.onOauthCallback = function (callbackUrl) {
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