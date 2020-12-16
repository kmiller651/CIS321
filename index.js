//Globals
var LOG, PRGM, PT;

//Init Visiual Memory
var VM = Array.from(Array(64), () => new Array(4));
var RAM = Array.from(Array(64), () => new Array(4));
var DISK = Array.from(Array(16), () => new Array(16));



function load() {
	//get canvases
	LOG = document.getElementById("logger");
	PRGM = document.getElementById("programs");
	PT = document.getElementById("pte");
	
	
	for (i=0;i<5;i++) {
		add_program("program" + (i+1));
	}
	
	//Init canvas printing
	init_visual_memory();
	
	//we can print to any memory location
	writeMemory(DISK, 0, "This is a sample sentence.");
	writeMemory(RAM, 0, "This is a loaded sentence.");
	writeMemory(VM, 0, "This is a simulated sentence.");
}

/* -------------------- HELPER FUNCTIONS -------------------- */
function writeMemory(mem_loc, start, text){
	//may overwrite things *** I need to write a 
	//"search for next available spot" function
	//and a "move to DISK if full" function
	w = mem_loc.length;
	var i = start;
	for (var c of text.split('')){
		mem_loc[i % w][Math.floor(i / w)].color("#00FF00");
		mem_loc[i % w][Math.floor(i / w)].write(c);
		i ++;
	}
}

function eraseMemory(mem_loc, start, length){
	//clear memory
	w = mem_loc.length;	
	for (var i = start; i < start + length; i++){
		mem_loc[i % w][Math.floor(i / w)].color("#000000");
	}
}

function zeroPad(n, c) {
	//number formatting
	return n.toString().padStart(c, "0");
}

function get_time(){
	//HH:MM:SS:iii
	var d = new Date();
	return zeroPad(d.getHours(), 2) + ":" +
		   zeroPad(d.getMinutes(), 2) + ":" +
		   zeroPad(d.getSeconds(), 2) + ":" +
		   zeroPad(d.getMilliseconds(), 3);
}

function add_log(text){
	//add log to the text box (auto scroll down via css)
	LOG.innerHTML += text + "<br>";
}

function add_PT_entry(text){
	//Add Page Table entry
	PT.innerHTML += "<option>" + text + "</option>";
}

function remove_PT_entry(index){
	//emove Page Table entry by index
	PT.remove(index);
}

function add_program(text){
	//add program to list
	PRGM.innerHTML += "<option>" + text + "</option>";
}

function remove_program(index){
	//remove program by index
	PRGM.remove(index);
}
/* -------------------- PROCESSOR -------------------- */
//bare bones processor class (change this to do whatever you had in mind)
class processor {
	constructor (){
		this.time = get_time();
		this.queue = [];
	}
	
	add_process(process){
		this.queue.push(process);
	}
	
	run(){
		//FIFO
		add_log(get_time() + " Run " + this.queue[0].name);
		
		this.queue[0].run();
		
		add_log(get_time() + " Complete " + this.queue[0].name);
		
	}
}

/* -------------------- PROCESSES -------------------- */
//********************* TODO HERE!! *****************************
class process {
	constructor (){
		//My brain isn't working rn. I know we need to make some simulated program to show the movement of memory.
		//If you would write those, I can get the graphics part up. All the functions to print things to the screen should already be written. 
	}
	
	p_delete(mem_loc, start, length){
		eraseMemory(mem_loc, start, length);
	}
	
	p_write(mem_loc, start, data){
		
	}
	
	p_copy_by_ref(mem_loc, start, length){
		//copy the Virtual memory but not the RAM
		
	}
	
	p_copy_by_value(mem_loc, start, length){
		//copy the virtual and RAM 
	}
	
	p_read(mem_loc, start, length){
		//load data from somewhere in memory
	}
}

/* -------------------- MEMORY -------------------- */

function init_visual_memory(){	
	//get canvas contexts to draw
	var vm_ctx = document.getElementById("canvas_vmem").getContext("2d");
	var ram_ctx = document.getElementById("canvas_ram").getContext("2d");
	var dsk_ctx = document.getElementById("canvas_disk").getContext("2d");
	
	//VM 64x8 grid
	for (var x = 0; x < 65; x++){
		for (var y = 0; y < 9; y++){
			if((x != 0) && (y != 0)){
				VM[x-1][y-1] = new canvas_memory(x, y, 23, 23, 5, 5, vm_ctx);
			}else{
				new canvas_memory(x, y, 23, 23, 5, 5, vm_ctx);
			}
		}
	}
	//RAM 64x4 grid
	for (var x = 0; x < 65; x++){
		for (var y = 0; y < 5; y++){
			if((x != 0) && (y != 0)){
				RAM[x-1][y-1] = new canvas_memory(x, y, 23, 23, 5, 5, ram_ctx);
			}else{
				new canvas_memory(x, y, 23, 23, 5, 5, ram_ctx);
			}
		}
	}
	//DISK 16x16 grid
	for (var x = 0; x < 17; x++){
		for (var y = 0; y < 17; y++){
			if((x != 0) && (y != 0)){
				DISK[x-1][y-1] = new canvas_memory(x, y, 23, 23, 5, 5, dsk_ctx);
			}else{
				new canvas_memory(x, y, 23, 23, 5, 5, dsk_ctx);
			}
		}
	}
	
}

class canvas_memory {
	
	constructor(x, y, w, h, Xoffset, Yoffset, ctx){
		this.x = x;
		this.y = y;
		this.ctx = ctx;
		this.xPos = x * (w + Xoffset) + Xoffset;
		this.yPos = y * (h + Yoffset) + Yoffset;
		this.w = w;
		this.h = h;
		this.init();
	}
	
	init(){	
		//Boxes
		if(!(this.x == 0) != !(this.y == 0)) { //0,x or x,0 not 0,0
			this.ctx.fillStyle = "#FFFFFF";
			this.ctx.beginPath();
			this.ctx.rect(this.xPos, this.yPos, this.w, this.h);
			this.ctx.stroke();	
			
			//Coordinates
			if(this.x == 0){
				this.write((this.y - 1).toString());
			}else{
				this.write((this.x - 1).toString());
			}
		}else if(this.x + this.y != 0){ //excluse 0,0
			//Black Fill
			this.ctx.fillStyle = "#000000";
			this.ctx.fillRect(this.xPos, this.yPos, this.w, this.h);
		}
	}
	
	write(str){
		//Write text (1 or 2 chars) in box
		this.ctx.fillStyle = "#000000";
		this.ctx.font = "18px Serif";
		
		if(str.length > 1){
			this.ctx.fillText(str, this.xPos + 3, this.yPos + 17);
		}else{
			this.ctx.fillText(str, this.xPos + 7, this.yPos + 17);
		}
	}
	
	color(c){
		//color box
		this.ctx.clearRect(this.xPos, this.yPos, this.w, this.h);
		this.ctx.fillStyle = c;
		this.ctx.fillRect(this.xPos, this.yPos, this.w, this.h);
	}
}