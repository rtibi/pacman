

// The actor class defines common data functions for the ghosts and pacman
// It provides everything for updating position and direction.

// "Ghost" and "Player" inherit from this "Actor"

// DEPENDENCIES:
// direction utility
// tileMap.teleport()
// tileMap.isTunnelTile()
// tileMap.getSurroundingTiles()

// Actor constructor
var Actor = function() {

    // initial position and direction
    this.startPixel = {};  // x,y pixel starting position (0<=x<tileCols*tileSize, 0<=y<tileRows*tileSize)
    this.startDirEnum = 0; // starting direction enumeration (0<=x,y<=4)

    // current position
    this.targetTile = {x:0,y:0}; // x,y current target tile (0<=x<tileCols, 0<=y<tileRows)
    this.tile = {};        // x,y tile position (0<=x<tileCols, 0<=y<tileRows)
    this.pixel = {};       // x,y pixel position (0<=x<tileCols*tileSize, 0<=y<tileRows*tileSize)
    this.tilePixel = {};   // x,y pixel in tile (0<=x,y<tileSize)
    this.distToMid = {};   // x,y pixel distance from center of tile

    // current direction
    this.dir = {};         // x,y direction (-1<=x,y<=1)
    this.dirEnum = 0;      // direction enumeration (0<=x,y<=4)

    // current frame count
    this.frame = 0;        // frame count
};

// reset to initial position and direction
Actor.prototype.reset = function() {
    this.setDir(this.startDirEnum);
    this.setPos(this.startPixel.x, this.startPixel.y);
};

// sets the position and updates its dependent variables
Actor.prototype.setPos = function(px,py) {
    this.pixel.x = px;
    this.pixel.y = py;
    this.commitPos();
};

// updates the position's dependent variables
Actor.prototype.commitPos = function() {

    // use map-specific tunnel teleport
    tileMap.teleport(this);

    this.tile.x = Math.floor(this.pixel.x / tileSize);
    this.tile.y = Math.floor(this.pixel.y / tileSize);
    this.tilePixel.x = this.pixel.x % tileSize;
    this.tilePixel.y = this.pixel.y % tileSize;
    this.distToMid.x = midTile.x - this.tilePixel.x;
    this.distToMid.y = midTile.y - this.tilePixel.y;
};

// sets the direction and updates its dependent variables
Actor.prototype.setDir = function(dirEnum) {
    setDirFromEnum(this.dir, dirEnum);
    this.dirEnum = dirEnum;
};

// used as "pattern" parameter in getStepSizeFromTable()
var STEP_PACMAN = 0;
var STEP_GHOST = 1;
var STEP_PACMAN_FRIGHT = 2;
var STEP_GHOST_FRIGHT = 3;
var STEP_GHOST_TUNNEL = 4;
var STEP_ELROY1 = 5;
var STEP_ELROY2 = 6;

// getter function to extract a step size from speed control table
Actor.prototype.getStepSizeFromTable = (function(){

    // Actor speed is controlled by a list of 16 values.
    // Each value is the number of steps to take in a specific frame.
    // Once the end of the list is reached, we cycle to the beginning.
    // This method allows us to represent different speeds in a low-resolution space.

    // speed control table (from Jamey Pittman)
    var stepSizes = (
                         // LEVEL 1
    "1111111111111111" + // pac-man (normal)
    "0111111111111111" + // ghosts (normal)
    "1111211111112111" + // pac-man (fright)
    "0110110101101101" + // ghosts (fright)
    "0101010101010101" + // ghosts (tunnel)
    "1111111111111111" + // elroy 1
    "1111111121111111" + // elroy 2

                         // LEVELS 2-4
    "1111211111112111" + // pac-man (normal)
    "1111111121111111" + // ghosts (normal)
    "1111211112111121" + // pac-man (fright)
    "0110110110110111" + // ghosts (fright)
    "0110101011010101" + // ghosts (tunnel)
    "1111211111112111" + // elroy 1
    "1111211112111121" + // elroy 2

                         // LEVELS 5-20
    "1121112111211121" + // pac-man (normal)
    "1111211112111121" + // ghosts (normal)
    "1121112111211121" + // pac-man (fright) (N/A for levels 17, 19 & 20)
    "0111011101110111" + // ghosts (fright)  (N/A for levels 17, 19 & 20)
    "0110110101101101" + // ghosts (tunnel)
    "1121112111211121" + // elroy 1
    "1121121121121121" + // elroy 2

                         // LEVELS 21+
    "1111211111112111" + // pac-man (normal)
    "1111211112111121" + // ghosts (normal)
    "0000000000000000" + // pac-man (fright) N/A
    "0000000000000000" + // ghosts (fright)  N/A
    "0110110101101101" + // ghosts (tunnel)
    "1121112111211121" + // elroy 1
    "1121121121121121"); // elroy 2

    return function(level, pattern, frame) {
        var entry;
        if (level < 1) return;
        else if (level==1)                  entry = 0;
        else if (level >= 2 && level <= 4)  entry = 1;
        else if (level >= 5 && level <= 20) entry = 2;
        else if (level >= 21)               entry = 3;
        return stepSizes[entry*7*16 + pattern*16 + frame%16];
    };
})();


// updates the actor state
Actor.prototype.update = function() {
    // get number of steps to advance in this frame
    var steps = this.getNumSteps(this.frame);
    var i;
    for (i=0; i<steps; i++) {
        this.step();
        this.steer();
    }
    this.frame++;
};

// retrieve four surrounding tiles and indicate whether they are open
Actor.prototype.getOpenSurroundTiles = function() {

    // get open passages
    var surroundTiles = tileMap.getSurroundingTiles(this.tile);
    var openTiles = {};
    var numOpenTiles = 0;
    var oppDirEnum = (this.dirEnum+2)%4; // current opposite direction enum
    var i;
    for (i=0; i<4; i++)
        if (openTiles[i] = tileMap.isFloorTile(surroundTiles[i]))
            numOpenTiles++;

    // By design, no mazes should have dead ends,
    // but allow player to turn around if and only if it's necessary.
    // Only close the passage behind the player if there are other openings.
    if (numOpenTiles > 1) {
        openTiles[oppDirEnum] = false;
    }
    // somehow we got stuck
    else if (numOpenTiles == 0) {
        this.dir.x = 0;
        this.dir.y = 0;
        this.dirEnum = -1;
        console.log(this.name,'got stuck');
        return;
    }

    return openTiles;
};

Actor.prototype.getTurnClosestToTarget = function(openTiles) {

    var dx,dy,dist;                      // variables used for euclidean distance
    var minDist = Infinity;              // variable used for finding minimum distance path
    var dir = {};
    var dirEnum = 0;
    var i;
    for (i=0; i<4; i++) {
        if (openTiles[i]) {
            setDirFromEnum(dir,i);
            dx = dir.x + this.tile.x - this.targetTile.x;
            dy = dir.y + this.tile.y - this.targetTile.y;
            dist = dx*dx+dy*dy;
            if (dist < minDist) {
                minDist = dist;
                dirEnum = i;
            }
        }
    }
    return dirEnum;
};

