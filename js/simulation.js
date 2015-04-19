var Sailr = Sailr || {};

Sailr.Simulation = function(){};

Sailr.Simulation.prototype = {
    preload: function() {
        this.load.image('boat', 'img/vo65.png');
        this.load.image('compass', 'img/compass.png');
        this.load.image('wind', 'img/wind200.png');
        this.load.image('water', 'img/water_deep.png');
        this.load.image('corona', 'img/blue.png');
        this.scale.pageAlignHorizontally = true;
        this.scale.pageAlignVertically = true;

        this.physics.startSystem(Phaser.Physics.P2);

        this.world.setBounds(0, 0, 10000, 10000);

        this.constants = {
            rudderAcceleration : 200,
            angularDrag : 200,
            maxAngular: 80,
            windShiftPeriod: 3*1000,
            windShiftChance: 0.5,
            windShiftRange: 20 //degrees
        };

        this.wind = {
            speed: 10,
            direction: 0,
            lastShift: 0,
            fixed: false,
            setDirection: function(direction) {
                this.lastShift = Date.now();
                this.direction = direction;
            },
            getBearingRelativeTo: function(compassBearing) {
                var diff = Math.abs(compassBearing - this.direction);
                return diff < 180 ? diff : 360 - diff; //returns values between 0 and 180
            }
        };
    },
    create: function() {
        this.startTime = Date.now();

        //water background
        this.water = this.add.tileSprite(0,0,10000,10000,'water');

        //THE BOAT
        this.boat = this.add.sprite(300,300, 'boat');
        //anchor from middle
        this.boat.anchor.setTo(0.5);
        //it's a big img
        this.boat.scale.setTo(0.2);
        this.physics.enable(this.boat);
        this.boat.body.maxAngular = this.constants.maxAngular;
        this.boat.body.collideWorldBounds = true;
        //simulate rudder steering, when at speed it will return to center
        this.boat.body.angularDrag = this.constants.angularDrag;
        this.boat.rotation = 1;

        this.camera.follow(this.boat);
        this.boat.bringToTop();

        this.velocity = new Victor();
        this.createWaterSprayEmitters();

        var style = { font: "18px Arial", fill: "#000", align: "right" };
        this.statusText = this.add.text(this.width-150, 30, "", style);
//    statusText.anchor.x = Math.round(statusText.width * 0.5) / statusText.width;
        this.statusText.fixedToCamera = true;

//    var directions = { font: "18px Arial", fill: "#000" };
//    var directionText = this.add.text(300, 10, "Use the left and right arrows to move your rudder", style);

        this.compass = this.add.sprite(0,0, 'compass');
        this.compass.scale.setTo(0.15);

        this.windSprite = this.add.sprite(400,10,'wind');
        this.windSprite.fixedToCamera = true;
        this.windSprite.anchor.setTo(0.5);
        this.windSprite.scale.setTo(0.3);
        this.windSprite.rotation = Phaser.Math.degToRad( this.wind.direction + 180 );
        this.wind.lastShift = Date.now();

        this.cursors = this.input.keyboard.createCursorKeys();

    },
    createWaterSprayEmitters : function () {
        //this should INCREASE with boat speed
        this.getParticleDuration = function() {
            return Math.round(this.velocity.lengthSq()) / 2;
        };

        //port and startboard emitters for spray particles
        this.waterSprayEmitter = this.add.emitter(this.boat.x, this.boat.y, 1000); //max particles
        this.waterSprayEmitter.makeParticles('corona');
//    waterSprayEmitter.setAlpha(1,0,particle_duration());
        this.waterSprayEmitter.minParticleScale = 0.3;
        this.waterSprayEmitter.maxParticleScale = 0.3;
        this.waterSprayEmitter.gravity = 0;

        this.waterSprayEmitter2 = this.add.emitter(this.boat.x, this.boat.y, 1000); //max particles
        this.waterSprayEmitter2.makeParticles('corona');
        this.waterSprayEmitter2.setAlpha(1,0,this.getParticleDuration());
        this.waterSprayEmitter2.minParticleScale = 0.3;
        this.waterSprayEmitter2.maxParticleScale = 0.3;
//    waterSprayEmitter2.particleDrag.setTo(50);
        this.waterSprayEmitter2.gravity = 0;

//    waterSprayEmitter.setScale(0.1);

        this.waterSprayEmitter.start(false, 1000, 30);
        this.waterSprayEmitter2.start(false, 1000, 30);

    },
    updateWindDirection: function() {
        //WIND SHIFT FUNCTION @todo => wind shifts too rapidly. boat can immediately stop (no momentum?)
        if( !this.wind.fixed && this.constants.windShiftPeriod < (Date.now() - this.wind.lastShift) ) {
            if( Math.random() < this.constants.windShiftChance ) {
                this.wind.setDirection(
                    //if the wind shift range is 45,the wind will shift up to +/- 22.5 degrees on either side
                    this.wind.direction + (this.constants.windShiftRange * Math.random()) - (this.constants.windShiftRange/2));
            } else {
                this.wind.lastShift = Date.now(); //delay the shift
            }
        }
    },
    update: function() {
        this.updateWindDirection();
        //update wind indicator
        this.windSprite.rotation = Phaser.Math.degToRad( this.wind.direction + 90 );

        //rudder alters the angular acceleration of the boat
        this.boat.body.angularAcceleration = 0;
        if(this.cursors.left.isDown) {
            this.boat.body.angularAcceleration = -this.constants.rudderAcceleration;
        } else if(this.cursors.right.isDown) {
            this.boat.body.angularAcceleration = this.constants.rudderAcceleration;
        }

        var gameSpeed = 0.5;
        var acceleration = gameSpeed * this.wind.speed *
            this.accelFunction[Math.floor(this.wind.getBearingRelativeTo(this.compassAngle(this.boat.body.rotation)))];


        //first compute relative wind
        //Relative wind = wind magnitude and angle + boat speed magnitude and angle


        var force = [0,0]; //x and y components of the force I believe!
        //make sure to give the boat mass

//    boat.body.applyForce([],[0,0])
        //windforce = windspeed * (factor between -0.2ish and 1 depending on your wind angle) * 10 because I said so
        var newSpeed = this.boat.body.velocity.getMagnitude() + acceleration;

        this.velocity = new Victor(newSpeed,0);
        this.velocity.rotate(Phaser.Math.degToRad(this.boat.body.rotation)-(Math.PI/2));

//
//    var scaleY = -Math.cos( Phaser.Math.degToRad( boat.body.rotation ));
//    var scaleX = Math.sin( Phaser.Math.degToRad( boat.body.rotation ));
////
//    boat.body.velocity.setMagnitude( newSpeed );
//
//    boat.body.velocity.x = scaleX * newSpeed;
//    boat.body.velocity.y = scaleY * newSpeed;

        this.boat.body.velocity.x = this.velocity.x;
        this.boat.body.velocity.y = this.velocity.y;

        var heading = this.compassAngle( Math.round(this.boat.body.rotation) ); //rotation is 90 degrees different then the game plane
//    console.log(heading);

        //update waves
        var wave_period = 4000;
        var wave_delta = 0.1 * Math.cos((2*Math.PI * (((Date.now()-this.startTime)%wave_period)))/wave_period) + 0.3;
        var wave = new Victor(wave_delta, 0);
        wave.rotate(Math.PI / 4);
        this.water.tilePosition.x += wave.x ;
        this.water.tilePosition.y += wave.y;

        //update
        var emitLocation = new Victor(0,-(this.boat.height/2)+7);
        emitLocation.rotate(this.boat.rotation);

        var starboardEmitVelocity = this.velocity.multiply(new Victor(-0.5,-0.5));
        var portEmitVelocity = starboardEmitVelocity.clone();
        starboardEmitVelocity.rotate(-Math.PI / 4);
        portEmitVelocity.rotate(Math.PI / 4);
        var particleDuration = this.getParticleDuration();
        this.waterSprayEmitter.forEachExists(function(p) {
            if(p.born !== undefined) {
                var alpha = 1 - ((Date.now() - p.born)/p.emittedDuration);
                if(alpha <= 0) {
                    p.kill();
                } else {
                    p.alpha = alpha;
                }
            } else {
                p.alpha = 1;
                p.emittedDuration = particleDuration;
                p.born = Date.now();
            }
        });
        this.waterSprayEmitter2.children.forEach(function(p) {
            if(p.born !== undefined) {
                var alpha = 1 - Math.min(1,Date.now() - p.born/p.emittedDuration);
//            console.log(p.born);
                if(alpha <= 0) {
//                    console.log("killed after " + (Date.now() - p.born) + "ms");
                    p.kill();
                } else {

                    p.alpha = alpha;
                }
            } else {
                p.alpha = 1;
                p.emittedDuration = particleDuration;
                p.born = Date.now();
            }
        });

        this.waterSprayEmitter.on = this.velocity.length() > 1;
//    waterSprayEmitter.lifespan = particle_duration();
//    waterSprayEmitter.setAlpha(1,0,particle_duration());
        this.waterSprayEmitter.minParticleSpeed.set(starboardEmitVelocity.x, starboardEmitVelocity.y);
        this.waterSprayEmitter.maxParticleSpeed.set(starboardEmitVelocity.x, starboardEmitVelocity.y);
        this.waterSprayEmitter.emitX = this.boat.x + emitLocation.x;
        this.waterSprayEmitter.emitY = this.boat.y + emitLocation.y;


        this.waterSprayEmitter2.on = this.velocity.length() > 1;
//    waterSprayEmitter2.lifespan = particle_duration();
//    waterSprayEmitter2.autoAlpha
//    waterSprayEmitter2.getFirstAlive().setAlpha(1,0,particle_duration);
        this.waterSprayEmitter2.minParticleSpeed.set(portEmitVelocity.x, portEmitVelocity.y);
        this.waterSprayEmitter2.maxParticleSpeed.set(portEmitVelocity.x, portEmitVelocity.y);
        this.waterSprayEmitter2.emitX = this.boat.x + emitLocation.x;
        this.waterSprayEmitter2.emitY = this.boat.y + emitLocation.y;

//    waterSprayEmitter.rotation = boat.rotation + Math.PI;
        this.statusText.text =
            "velX: " + Math.round(this.boat.body.velocity.x) +
                "\nvelY: " + Math.round(this.boat.body.velocity.y) +
                "\nheading: " + heading +
                "\nWind: " + Math.round(this.wind.speed) + "kts @ " + Math.round(this.compassAngle(this.wind.direction)) +
                "\nAngle: " + Math.round(this.wind.getBearingRelativeTo(heading)) +
                "\n" + this.boatPointOfSail().name
                + "\nvelo: " + Math.round(this.velocity.length())
//            + "\nangularA: " + Math.round(boat.body.angularAcceleration)
//            + "\nnow: " + Date.now()
//            +"\ntargetX: " + Math.round(targetXVelocity)
//            +"\ntargetY: " + Math.round(targetYVelocity)
//            +"\nwaveX: " + wave.x
            +"\npdur " + this.getParticleDuration()
        ;
    },
    compassAngle: function(degrees) {
        var angle = degrees;
        if(angle < 0)
            angle += 360;
        else if(angle >= 360)
            angle -= 360;
        return angle;
    },
    boatPointOfSail: function() {
        return this.pointOfSail(
            this.wind.getBearingRelativeTo(
                this.compassAngle( Math.round(this.boat.body.rotation) )
            )
        );
    }, pointOfSail: function(bearingFromWind) {
        var bearing = Math.floor(bearingFromWind);
        if( bearing <= 35 ) {//america's cup angles
            return {
                name: "In Irons",
                maxSpeedFactor: -0.0005,
                accelerationFactor: 0.3
            }
        } else if( bearing >= 36 && bearing <= 72 ) {
            return {
                name: "Close Hauled",
                maxSpeedFactor: 0.6,
                accelerationFactor: 0.6
            }
        } else if(  bearing >= 73 && bearing <= 108 ) {
            return {
                name: "Beam Reaching",
                maxSpeedFactor: 0.75,
                accelerationFactor: 0.75
            }
        } else if( bearing >= 109 && bearing <= 144) {
            return {
                name: "Reaching",
                maxSpeedFactor: 1,
                accelerationFactor: 1
            }
        } else if( bearing >= 145 ) {
            return {
                name: "Downwind",
                maxSpeedFactor: 0.9,
                accelerationFactor: 1
            }
        }
    }, accelFunction: [
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.25,
        -0.2,
        -0.15,
        -0.1,
        -0.05,
        0,
        0,
        0.1,
        0.2,
        0.3,
        0.4,
        0.45,
        0.5,
        0.55,
        0.6,
        0.6045454545,
        0.6090909091,
        0.6136363636,
        0.6181818182,
        0.6227272727,
        0.6272727273,
        0.6318181818,
        0.6363636364,
        0.6409090909,
        0.6454545455,
        0.65,
        0.6545454545,
        0.6590909091,
        0.6636363636,
        0.6681818182,
        0.6727272727,
        0.6772727273,
        0.6818181818,
        0.6863636364,
        0.6909090909,
        0.6954545455,
        0.7,
        0.7045454545,
        0.7090909091,
        0.7136363636,
        0.7181818182,
        0.7227272727,
        0.7272727273,
        0.7318181818,
        0.7363636364,
        0.7409090909,
        0.7454545455,
        0.75,
        0.7545454545,
        0.7590909091,
        0.7636363636,
        0.7681818182,
        0.7727272727,
        0.7772727273,
        0.7818181818,
        0.7863636364,
        0.7909090909,
        0.7954545455,
        0.8,
        0.8045454545,
        0.8090909091,
        0.8136363636,
        0.8181818182,
        0.8227272727,
        0.8272727273,
        0.8318181818,
        0.8363636364,
        0.8409090909,
        0.8454545455,
        0.85,
        0.8522222222,
        0.8544444444,
        0.8566666667,
        0.8588888889,
        0.8611111111,
        0.8633333333,
        0.8655555556,
        0.8677777778,
        0.87,
        0.8722222222,
        0.8744444444,
        0.8766666667,
        0.8788888889,
        0.8811111111,
        0.8833333333,
        0.8855555556,
        0.8877777778,
        0.89,
        0.8922222222,
        0.8944444444,
        0.8966666667,
        0.8988888889,
        0.9011111111,
        0.9033333333,
        0.9055555556,
        0.9077777778,
        0.91,
        0.9122222222,
        0.9144444444,
        0.9166666667,
        0.9188888889,
        0.9211111111,
        0.9233333333,
        0.9255555556,
        0.9277777778,
        0.93,
        0.9322222222,
        0.9344444444,
        0.9366666667,
        0.9388888889,
        0.9411111111,
        0.9433333333,
        0.9455555556,
        0.9477777778,
        0.95,
        0.9511111111,
        0.9522222222,
        0.9533333333,
        0.9544444444,
        0.9555555556,
        0.9566666667,
        0.9577777778,
        0.9588888889,
        0.96,
        0.9611111111,
        0.9622222222,
        0.9633333333,
        0.9644444444,
        0.9655555556,
        0.9666666667,
        0.9677777778,
        0.9688888889,
        0.97,
        0.9711111111,
        0.9722222222,
        0.9733333333,
        0.9744444444,
        0.9755555556,
        0.9766666667,
        0.9777777778,
        0.9788888889,
        0.98,
        0.9811111111,
        0.9822222222,
        0.9833333333,
        0.9844444444,
        0.9855555556,
        0.9866666667,
        0.9877777778,
        0.9888888889,
        0.99,
        0.9911111111,
        0.9922222222,
        0.9933333333,
        0.9944444444,
        0.9955555556,
        0.9966666667,
        0.9977777778,
        0.9988888889,
        1]
}