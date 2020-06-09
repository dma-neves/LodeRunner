/*     Lode Runner

Aluno 1: 55539 David Neves <-- mandatory to fill
Aluno 2: 55902 Rodrigo Mesquita <-- mandatory to fill

Comentario:

O ficheiro "LodeRunner.js" tem de incluir, logo nas primeiras linhas,
um comentário inicial contendo: o nome e número dos dois alunos que
realizaram o projeto; indicação de quais as partes do trabalho que
foram feitas e das que não foram feitas (para facilitar uma correção
sem enganos); ainda possivelmente alertando para alguns aspetos da
implementação que possam ser menos óbvios para o avaliador.

Notas:

	Decidimos apenas redesenhar (chamada a funcao draw) os Active Actors todos
	duma vez apos todos updates/animacoes terem ocorrido pois a atualizacao da
	imagem de um ator ativo nao depende apenas do seu estados mas tambem do
	estado de outras entidades no jogo que precisam de tambem estar atualizadas

01234567890123456789012345678901234567890123456789012345678901234567890123456789
*/


const BRICK_REGEN_TIME = 5015 //in miliseconds
const TIME_TO_UNSTUCK = 2010

// GLOBAL VARIABLES

// tente não definir mais nenhuma variável global

let empty, hero, control;

// ACTORS

class Actor {
	constructor(x, y, imageName) {
		this.x = x;
		this.y = y;
		this.imageName = imageName;
		this.show();
	}

	draw(x, y) {
		// let ACTOR_PIXELS_X2 =ACTOR_PIXELS_X*2;
		// let ACTOR_PIXELS_Y2 = ACTOR_PIXELS_Y*2;

		control.ctx.drawImage(GameImages[this.imageName],
				x * ACTOR_PIXELS_X, y* ACTOR_PIXELS_Y);
	}

	//Collectible items have a property named worthpoints for 
	//how many points the collectible is worth
	collectible() { return this.worthpoints != undefined }
}

class PassiveActor extends Actor {
	show() {
		control.world[this.x][this.y] = this;
		super.draw(this.x, this.y);
	}
	hide() {
		control.world[this.x][this.y] = empty;
		empty.draw(this.x, this.y);
	}


	//passive actors to be shown when all collectibles are collected
	showOnWin() { return false; }

	floor() { return false; }
	solid() { return false; }
	climbable() { return false; }

	//breakable actors must react to a shot
	breakable() { return this.shot != undefined; }
}


class Brick extends PassiveActor {

	constructor(x, y) { super(x, y, "brick"); }

	shot() { //Bricks react to shots by breaking

		if(!this.isHidden()) {

			this.imageName = "empty"
			this.show();

			this.timeout = setTimeout(() => {
				this.regen();
				delete control.timeouts[this.timeout]
			}, BRICK_REGEN_TIME)

			//BRICK REGEN TIME must be > 0 or this will run after deletion
			control.timeouts[this.timeout] = true;
		}
	}

	regen() {

		let activeActor = control.getActive(this.x, this.y);
		if (activeActor != empty) {
			activeActor.kill();
		}
		this.makeVisible();

	}

	makeVisible() {
		
		this.imageName = "brick";
		this.show()
	}

	isHidden() { return this.imageName != "brick"; }

	floor() { return !this.isHidden(); }
	solid() { return !this.isHidden(); }
}

class Chimney extends PassiveActor {
	constructor(x, y) { super(x, y, "chimney"); }
}

class Empty extends PassiveActor {
	constructor() { super(-1, -1, "empty"); }
	show() {}
	hide() {}

}

class Gold extends PassiveActor {
	constructor(x, y) {
		super(x, y, "gold");
		this.worthpoints = 3;
	}
}

class Invalid extends PassiveActor {
	constructor(x, y) { super(x, y, "invalid"); }
}

class Ladder extends PassiveActor {
	constructor(x, y) {
		super(x, y, "empty");
	}

	makeVisible() {
		this.imageName = "ladder";
		this.show();
	}

	showOnWin() { return true; }

	isHidden() { return this.imageName != "ladder"; }

	floor() { return !this.isHidden(); }
	climbable() { return !this.isHidden(); }

}

class Rope extends PassiveActor {
	constructor(x, y) { super(x, y, "rope"); }

	climbable() { return true; }
}

class Stone extends PassiveActor {
	constructor(x, y) { super(x, y, "stone"); }

	floor() { return true; }
	solid() { return true; }
}


class Boundary extends Stone {

	floor() { return true; }
	solid() { return true; }

	show() {}
	hide() {}
}



class ActiveActor extends Actor {

	constructor(x, y, imageName) {
		super(x, y, imageName);
		this.time = 0;	// timestamp used in the control of the animations
		this.direction = "left";
		this.shooting = false;
		this.inventory = []
		this.alive = true;
	}

	show() {

		// Active actors show() function doesnt call the draw function
		// Because all active actors are rendered at once after they all
		// Updated
		control.worldActive[this.x][this.y] = this;
	}

	hide() {

		control.worldActive[this.x][this.y] = empty;
		control.world[this.x][this.y].draw(this.x, this.y);
	}

	animation() {
	}

	collidable() { return true; }

	isEnemy()  { return false; }

	isGrounded() {
		
		if(control.getPassive(this.x, this.y + 1).floor()) return true;

		let actor = control.getActive(this.x, this.y + 1);
		return actor == empty ? false : actor.collidable();
	}

	isClimbing() { return control.getPassive(this.x, this.y).climbable(); }

	isFalling() { return  !this.isGrounded() && !this.isClimbing(); }

	move(dx, dy) {


		if(this.isFalling()) {

			[dx, dy] = [0, 1];
		}

		if(dx == 0 && dy == 0) return false;

		// If actor is moving vertically up, he must be climbing onto a floor 
		// (example: stair)
		if( dy < 0 && !( this.isClimbing() &&
		control.getPassive(this.x, this.y).floor() ) ) return false;

		if( control.getPassive(this.x+dx, this.y+dy).solid() ) return false;

		let actor = control.getActive(this.x+dx, this.y+dy)
		if(actor != empty && this.collidable() && actor.collidable()) {
			this.collideWith(actor);
			actor.collideWith(this);

			return false;
		}

		if(control.getPassive(this.x+dx, this.y+dy).collectible()) {
			this.collectItem(this.x+dx, this.y+dy)
		}

		this.hide();
		
		this.x += dx;
		this.y += dy;

		if(!this.shooting && dx > 0) this.direction = "right";
		if(!this.shooting && dx < 0) this.direction = "left";

		if(dy != 0 && this.isClimbing())
			this.direction = this.direction == "left" ? "right" : "left";

		this.show();

		return true;
	}

	getImagePrefix() {}

	getMovementState() {

		if(this.isFalling()) return "falls";
		if(this.shooting) return "shoots";

		let actor = control.getPassive(this.x, this.y);
		if(actor.climbable()) return "on_" + actor.imageName;

		return "runs";
	}

	updateImage() {

		this.imageName = this.getImagePrefix() + "_" +
		this.getMovementState() + "_" + this.direction;
	}

	draw() {

		this.updateImage();
		super.draw(this.x, this.y)
	}

	kill() {
		this.alive = false; 
		this.hide();
	}
}






class Hero extends ActiveActor {

	constructor(x, y) {

		super(x, y, "hero_runs_left");
		this.score = 0;
		this.highscore = 0;
		this.inventory = [];
	}

	//Shoot returns the recoil movement
	shoot() {

		if(!this.isFalling()) {
			
			this.shooting = true;
			let shootX = this.direction == "left" ? -1 : 1;

			//Take the shot
			if(control.getPassive(this.x+shootX, this.y+1).breakable() &&
			!control.getPassive(this.x+shootX, this.y).solid()) {

				control.getPassive(this.x+shootX, this.y+1).shot();
			}

			//Handle recoil
			if (!control.getPassive(this.x-shootX, this.y).solid() &&
			control.getPassive(this.x-shootX, this.y+1).floor())
				return [-shootX, 0];
		}
		return [0, 0]
	}

	animation() {

		if(control.levelItems == -1 && this.y == 0 &&
		control.getPassive(this.x, this.y).climbable()) {

			control.gotoNextLevel();
			return;
		} 
		else if (control.getPassive(this.x, this.y).breakable() &&
		this.y == WORLD_HEIGHT-1) {

			// If hero falls in a hole on top of a boundary -> game is lost 
			this.kill();
			return;
		}

		let k = control.getKey();
		let [dx, dy] = [0,0];

		if( k == ' ' ) {
			[dx, dy] = this.shoot();
		} 
		else if ( k != null) {
			[dx, dy] = k;
			this.shooting = false;
		}

		this.move(dx, dy);
	}
	collectItem(x, y) {

		let item = control.getPassive(x, y);
		this.inventory.push(item);
		this.score += item.worthpoints;

		control.updateLevelCoinsInfo()
		control.updateScore()

		item.hide();
	}

	clearInventory() { this.inventory = []; }

	move(dx, dy) {
		
		//control.levelItems is -1 when all coins have been picked up and
		//the stairs are visible.
		if(control.levelItems == -1 && this.y+dy == 0 &&
		control.getPassive(this.x+dx, this.y+dy).climbable())
			control.gotoNextLevel();
		else
			super.move(dx, dy);
	}

	collideWith(actor) {

		if(actor.isEnemy())
			this.kill();
	}

	getImagePrefix() { return "hero"; }
}


class Robot extends ActiveActor {

	constructor(x, y) {
		super(x, y, "robot_runs_right");
		this.dx = 1;
		this.dy = 0;
		
		this.killpoints = 5;

		this.isStuck = false;
		this.gettingUnstuck = false;
	}

	update_stuck() {

		if(this.isStuck) {

			if (this.inventory.length) this.dropItemStuck();
			return true;
		}

		if (control.getPassive(this.x, this.y).breakable()) {

			if (this.inventory.length) this.dropItemStuck();

			this.isStuck = true;

			let t = setTimeout(() => {
				this.gettingUnstuck = true;
				delete control.timeouts[t];
			}, TIME_TO_UNSTUCK)

			control.timeouts[t] = true;
			return true;
		}

		return false;
	}

	dropItemRunning() {

		if(this.isGrounded() &&
		control.getPassive(this.x, this.y+1) != control.boundary && 
		!this.isClimbing() && control.getPassive(this.x, this.y) == empty ) {

			let item = this.inventory.pop();
			item.x = this.x;
			item.y = this.y;
			item.show();
		}
	}

	dropItemStuck() {

		if(control.getPassive(this.x, this.y-1) == empty) {

			let item = this.inventory.pop();
			item.x = this.x;
			item.y = this.y-1;
			item.show();
		}
	}

	isEnemy() { return true; }

	robotAiMove() {

		if(this.isStuck) {

			if(this.gettingUnstuck &&
			control.getActive(this.x, this.y-1) === empty) {

				this.hide()
			
				let pactor = control.getPassive(this.x, this.y);
				if(pactor.breakable()) {
					delete control.timeouts[pactor.timeout]
					clearTimeout(pactor.timeout)
					pactor.regen()
				}

				this.y--;
				this.show();

				this.isStuck = false;
				this.gettingUnstuck = false;

			}
		}
		else {

			let movements = [];

			let distanceToHero = distance(hero.x, hero.y, this.x, this.y)

			movements.push( [ [0, -1], 
							distance(hero.x, hero.y, this.x, this.y - 1)] );
			movements.push( [ [0, 1], 
							distance(hero.x, hero.y, this.x, this.y + 1)] );
			movements.push( [ [1, 0], 
							distance(hero.x, hero.y, this.x + 1, this.y)] );
			movements.push( [ [-1, 0], 
							distance(hero.x, hero.y, this.x - 1, this.y)] );

			movements = movements.filter(m => m[1] <= distanceToHero);
			movements.sort( (m1, m2) => m1[1] - m2[1] );

			for(let mov of movements) {

				let [dx, dy] = mov[0];
				if( this.move(dx, dy) ) break;
			}
		}
	}

	collideWith(actor) {

		if(!actor.isEnemy())
			actor.kill();
	}

	animation() {

		if(this.inventory.length && rand(ANIMATION_EVENTS_PER_SECOND * 4) < 1)
			this.dropItemRunning();

		if (this.time % control.difficultySpeedMod != 0) return;

		this.update_stuck();
		this.robotAiMove();
	}
	
	collectItem(x, y) {

		if (!this.inventory.length) {
			let item = control.getPassive(x, y)
			this.inventory.push(item);
	 		item.hide();
		}
	}

	isFalling() {

		return super.isFalling() && !this.isStuck;
	}

	isClimbing() {
		
		return super.isClimbing() || this.isStuck;
	}

	kill() {

		super.kill();
		hero.score += this.killpoints;

		// If Robot dies with an item the game is lost
		if(this.inventory.length)
			hero.kill();

		control.updateScore();
	}

	getImagePrefix() { return "robot"; }
}


// GAME CONTROL

class GameControl {
	constructor() {
		control = this;
		this.key = 0;
		this.time = 0;
		this.level = 1;

		this.setDifficulty(); //The number of times to divide the robots 
							  //speed by. The higher the number, the slower 
							  //the robots.

		this.timeouts = {}

		this.styleCanvas();

		this.ctx = document.getElementById("canvas1").getContext("2d");
		empty = new Empty();	// only one empty actor needed
		this.boundary = new Boundary();
		this.world = this.createMatrix();
		this.worldActive = this.createMatrix();
		this.loadLevel(this.level);
		this.setupEvents();
	}
	styleCanvas() {
		let cs = document.getElementById("canvas1").style
		cs.width = "756"; //Original = 504
		cs.height = "408"; //Original = 272
		
	}
	updateInfo() {
		document.getElementById("time").innerHTML = control.time/10;
	}
	updateScore() {
		document.getElementById("playerscore").innerHTML = hero.score;
	}
	updateHighscore() {
		document.getElementById("highscore").innerHTML = hero.highscore;
	}
	updateLevelInfo() {
		document.getElementById("worldlevel").innerHTML = control.level;
	}
	updateLevelCoinsInfo() {
		document.getElementById("coinsleft").innerHTML = 
		control.levelItems > 0 ? control.levelItems - hero.inventory.length : 0;
	}
	createMatrix() { // stored by columns
		let matrix = new Array(WORLD_WIDTH);
		for( let x = 0 ; x < WORLD_WIDTH ; x++ ) {
			let a = new Array(WORLD_HEIGHT);
			for( let y = 0 ; y < WORLD_HEIGHT ; y++ )
				a[y] = empty;
			matrix[x] = a;
		}
		return matrix;
	}

	gotoNextLevel() {

		this.level++;
		if(this.level > 16) {

			alert("You won! Score: "+ hero.score + " Time: " + control.time/10);
			hero.kill();
		}
		else this.gotoLevel(this.level)
	}

	gotoLevel(level) {

		for(let x=0 ; x < WORLD_WIDTH ; x++) {
			for(let y=0 ; y < WORLD_HEIGHT ; y++) {
				this.world[x][y].hide();
				this.worldActive[x][y].hide();
			}
		}
		
		hero.clearInventory()
		this.world = control.createMatrix();
		this.worldActive = control.createMatrix();
		this.loadLevel(level);
	}

	loadLevel(level) {

		this.updateLevelInfo()
		for (let t in this.timeouts) {
			clearTimeout(t);
		}
		this.timeouts = {}
		this.levelItems = 0; //number of collectible items in a level
		if( level < 1 || level > MAPS.length )
			fatalError("Invalid level " + level)
		let map = MAPS[level-1];  // -1 because levels start at 1
		for(let x=0 ; x < WORLD_WIDTH ; x++)
			for(let y=0 ; y < WORLD_HEIGHT ; y++) {
					// x/y reversed because map stored by lines
				let go = GameFactory.actorFromCode(map[y][x], x, y);
				if (go.collectible())
					this.levelItems++;
			}
		this.updateLevelCoinsInfo()
	}

	setDifficulty() {

		switch(document.getElementById("difficulty").selectedIndex) {
			case 0: //Difficulty easy
				this.difficultySpeedMod = 4;
				break;
			case 1: //Difficulty normal
				this.difficultySpeedMod = 3;
				break;
			case 2: //Difficulty hard
				this.difficultySpeedMod = 2;
				break;
		}
	}

	getKey() {
		let k = control.key;
		control.key = 0;
		switch( k ) {
			case 37: case 79: case 74: return [-1, 0]; //  LEFT, O, J
			case 38: case 81: case 73: return [0, -1]; //    UP, Q, I
			case 39: case 80: case 76: return [1, 0];  // RIGHT, P, L
			case 40: case 65: case 75: return [0, 1];  //  DOWN, A, K
			case 0: return null;
			default: return String.fromCharCode(k);
	// http://www.cambiaresearch.com/articles/15/javascript-char-codes-key-codes
		};	
	}
	setupEvents() {
		addEventListener("keydown", this.keyDownEvent, false);
		addEventListener("keyup", this.keyUpEvent, false);
		setInterval(this.animationEvent, 1000 / ANIMATION_EVENTS_PER_SECOND);
	}
	animationEvent() {
		control.time++;

		let actives = []

		hero.time = control.time;
		hero.animation();
		actives.push(hero);

		for(let x=0 ; x < WORLD_WIDTH ; x++)
			for(let y=0 ; y < WORLD_HEIGHT ; y++) {
				let a = control.worldActive[x][y];
				if( a.time < control.time ) {

					a.time = control.time;
					actives.push(a);

					a.animation();
				}
			}

		// Draw all active actors after they all have been updated
		for(let active of actives) {

			if(active.alive)
				active.draw();
		}

		if(control.levelItems == hero.inventory.length) {
			for(let x=0; x<WORLD_WIDTH; x++)
				for(let y=0; y<WORLD_HEIGHT; y++) {
					let a = control.world[x][y];
					if (a.showOnWin())
						a.makeVisible();
				}
			control.levelItems = -1;
		}

		if(!hero.alive) {
			
			control.restartGame();
		}


		control.updateInfo()
		
	}
	keyDownEvent(k) {
		control.key = k.keyCode;
	}
	keyUpEvent(k) {
	}

	restartGame() {

		if(hero.score > hero.highscore) {
			hero.highscore = hero.score;
			this.updateHighscore();
		}
	
		hero.clearInventory();
		control.time = 0;
	
		control.level = 1;
		hero.score = 0;
		this.updateScore();
		control.gotoLevel(control.level);
	}

	withinBounds(x, y) {

		return x >= 0 && y >= 0 && x < WORLD_WIDTH && y < WORLD_HEIGHT;
	}

	getPassive(x,y) {

		if(!control.withinBounds(x,y)) return control.boundary;

		else return control.world[x][y];
	}

	getActive(x,y) {

		if(!control.withinBounds(x,y)) return control.boundary;

		else return control.worldActive[x][y];
	}
}


// HTML FORM

function onLoad() {
  // Asynchronously load the images an then run the game
	GameImages.loadAll(function() { new GameControl(); });
}

let audio = null;   // global

function startAudio() {

	if( audio == null )
		audio = new Audio(
		"http://ctp.di.fct.unl.pt/miei/lap/projs/proj2020-3/files/louiscole.m4a"
		);

	audio.loop = true;
	audio.play();  // requires a previous user interaction with the page
}

function pauseAudio() {
	if( audio != null )
		audio.pause();
}

let playing = false;

function toggleAudio() {

	if(!playing) startAudio();

	else pauseAudio();

	playing = !playing;
}
