import "core-js/modules/es6.promise";

var botvac = require('node-botvac');
var client = new botvac.Client();

const username = scriptSettings.getString('username');
const password = scriptSettings.getString('password');
if (!username || !password) {
    throw new Error('You must provide "username" and "password" values in your Script Settings.');
}

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

    deviceManager.onDevicesChanged({
        devices
    });
}

var deviceProvider = new DeviceProvider();

//authorize
client.authorize(username, password, false, function (error) {
    if (error) {
        throw error;
    }

    //get your robots
    client.getRobots(function (error, robots) {
        if (error) {
            console.log(error);
            return;
        }
        var validRobots = robots
            .filter(robot => robot._serial && robot._secret);

        deviceProvider.updateRobots(validRobots);
    });
});


exports.result = deviceProvider;