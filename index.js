//Globals
var LOG, PRGM, PT;
var PROCESSES = [];
var ALL_MEMORY = {}
//Init Visiual Memory
var VM = Array.from(Array(64), () => new Array(4));
var RAM = Array.from(Array(64), () => new Array(4));
var DISK = Array.from(Array(16), () => new Array(16));
var PAGE_TABLE = {};


function load() {
	//get canvases
	LOG = document.getElementById("logger");
	PRGM = document.getElementById("programs");
	PT = document.getElementById("pte");
	Proc = new processor();
	np_arr = [];
	
	
	for (i=0;i<5;i++) {
		add_program("program" + (i+1));
		np = ("program" + (i+1));
		np_arr.push(np);
	}
	
	//Init canvas printing
	init_visual_memory();
	
	
	np = new process("This is a test");
	np = new process("This is a test");
	np = new process("This is a test");
	np = new process("This is a test");
	np = new process("This is a test");
	np = new process("This is a test");
	np = new process("This is a test");
	np = new process("This is a test");
	np = new process("This is a test");
	np = new process("This is a test");
	np = new process("This is a test");
	np = new process("This is a test");
	np = new process("This is a test");
	np = new process("This is a test");
	np = new process("This is a test");
	np = new process("This is a test");
	np = new process("Is this a test");
	delete PAGE_TABLE["0x00"];
	PT.remove(0);
	//we can print to any memory location
	//writeMemory(DISK, "This is a sample sentence.");
	//writeMemory(RAM, "This is a loaded sentence.");
	//writeMemory(VM, "This is a simulated sentence.");
}

/* -------------------- HELPER FUNCTIONS -------------------- */
function loadData(data){
	//On init, we need to load the data into RAM, 
	add_log("Loading Data into RAM: " + data);
	
	//put data into RAM (address 8 bits)
	var RAM_address = writeMemory(RAM, data);
	
	//On init, we need to load the data into RAM, 
	add_log("Loading Data to Virtual Memory: " + data);
	
	//put data into RAM (address (page, offset))
	var VM_address = writeMemory(VM, data);
	
	//add page table entry
	add_PT_entry(VM_address, RAM_address);
	//return the VM address
	return VM_address;
}

function navigate(mem_loc, start, len, func){
	
	if(mem_loc === RAM){
		//nav RAM by page
		for(var r = start[2]; r < 4; r++){
			//start at offset c if first row, otherwise 0
			for(var c = (r == start[2] ? start[1] : 0); c < 16; c++){
				if(len > 0){
					len = func(c, r);
				}
			}
		}
	}else{
		//clear to VM or DISK linearly
		for(var r = start[1]; r < mem_loc[0].length; r++){
			//start at offset c if first row, otherwise 0
			for(var c = (r == start[1] ? start[0] : 0); c < mem_loc.length; c++){
				if(len > 0){
					len = func(c, r);
				}
			}
		}
	}
}	

function writeMemory(mem_loc, text){
	console.log("Writing " + text + " to " + ((mem_loc==RAM) ? "RAM" : (mem_loc==DISK) ? "DISK" : "VM"));
	//search for available memory
	len = text.length;
	var start = searchForFreeSpace(mem_loc, len);
	console.log(text, start);
	
	if(start){
		data = text.split('');
					
		navigate(mem_loc, start, data.length, (c, r) => {
			//write to RAM
			mem_loc[c + ((mem_loc === RAM) ? (start[0]*16) : 0)][r].fill("#00FF00", data[0]);
			//remove letter
			data.shift();
			return data.length;
		});
		
		if(mem_loc === RAM){
			//return RAM address
			return start;
		}else{
			//return VM or DISK address (0-255) -> (00-FF) in hex
			console.log(start[1]*mem_loc[0].length + start[0], start, mem_loc[0].length);
			return "0x" + zeroPad((start[1]*mem_loc.length + start[0]).toString(16), 2);
		}
	}else{
		switch(mem_loc){
			case RAM:
				//move memory out to DISK (addr, len)
				ram_loc = analyzeMemory(len);
				//log process
				add_log("Moving data from RAM to Disk");
				
				//move data to DISK from RAM (and erase the RAM)
				//PAGE_TABLE[ram_loc[0]] is string not start
				shiftToDISK(PAGE_TABLE[ram_loc[0]], ram_loc[1]);
				//return the address where memory was loaded
				return writeMemory(mem_loc, text);
				
			case VM:
				add_log("Error: Virtual Memory Full");
				return null;
			case DISK:
				add_log("Error: Out of Disk Space");
				return null;
		}
	}
}

function analyzeMemory(len){
	//look for least used segment in RAM of at least length len and move it to DISK
	DISK_has_space = searchForFreeSpace(DISK, len);
	
	if(DISK_has_space){
		activeMemory = []
		//Get all memory chunks of sufficient size
		for (var p of PROCESSES){
			for (var m of p.activeVM){
				if(m[1] >= len){
					activeMemory.push([p, m]);
				}
			}
		}
		//sort by oldest use
		activeMemory.sort((a, b) => {
			return a[0].lastAccess > b[0].lastAccess;
		});
		
		//return RAM address
		return activeMemory[0][1];
	}else{
		//No room to put new data
		add_log("Error: Insufficient Memory");
		return null;
	}
}

function shiftToDISK(start, len){
	data = readMemory(RAM, start, len);
	console.log(writeMemory(DISK, data));
	eraseMemory(RAM, start, len);
}

function searchForFreeSpace(mem_loc, len){
	var counter = 0;
	var start = [];
	if(mem_loc === RAM){
		//page, row, column
		for(var p = 0; p < 4; p++){
			for(var r = 0; r < 4; r++){
				for(var c = 0; c < 16; c++){
					//empty space in memory
					if(!mem_loc[(p*16) + c][r].hasData){
						//no previous empty slots, register new start
						if(counter == 0){
							start = [p, c, r];
						}
						//count open spots
						counter ++;
						//stop when we get to len
						if(counter == len){
							return start;
						}
					}else{
						//reset if we hit data
						counter = 0;
					}
				}
			}
			//no page overflow
			counter = 0;
		}
	}else{
		for(var r = 0; r < mem_loc[0].length; r++){
			for(var c = 0; c < mem_loc.length; c++){
				//empty space in memory
				if(!mem_loc[c][r].hasData){
					//no previous empty slots, register new start
					if(counter == 0){
						start = [c, r];
					}
					//count open spots
					counter ++;
					//stop when we get to len
					if(counter == len){
						return start;
					}
				}else{
					//reset if we hit data
					counter = 0;
				}
			}
		}
	}
	
	return null;
}

function eraseMemory(mem_loc, start, len){
	//clear memory
	navigate(mem_loc, start, len, (c, r) => {
		mem_loc[c + ((mem_loc === RAM) ? (start[0]*16) : 0)][r].color("#000000");
			len --;
		return len;
	});
}

function readMemory(mem_loc, start, len){
	data = "";
	//read data from memory
	navigate(mem_loc, start, len, (c, r) => {
		data += mem_loc[c + ((mem_loc === RAM) ? (start[0]*16) : 0)][r].data;
		len --;
		return len;
	});
	return data;
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
	LOG.innerHTML += get_time() + " - " + text + "<br>";
}

function add_PT_entry(vm_addr, ram_addr){
	//Add Page Table entry
	PAGE_TABLE[vm_addr] = ram_addr;
	//reformat ram display
	var ram_out = ram_addr[0] + ", " + zeroPad((ram_addr[2]*16 + ram_addr[1]).toString(16), 2);
	//print to table
	PT.innerHTML += "<option onmouseup='recolorMem(true)' onmousedown='recolorMem(false)'>" + vm_addr + " || (" + ram_out + ")</option>";
}

function remove_PT_entry(key, index){
	//remove Page Table entry by index
	delete PAGE_TABLE[key];
	PT.remove(index);
}

function delete_PT(key) {
	if(this.hasKey(key)) {
		delete this.container[key];
		return true;
	}
	return false;
}

function add_program(text){
	//add program to list
	PRGM.innerHTML += "<option>" + text + "</option>";
}

function remove_program(index){
	//remove program by index
	PRGM.remove(index);
}

function clear_output() {
	var e = document.getElementById("output");
	e.innerHTML = "<button onclick='Proc.add_process(value)' id='runProgram'>Run</button>";
}

function recolorMem(selected){
	key = PT.value.split(" || ")[0];	
	counter = ALL_MEMORY[key];
	navigate(RAM, PAGE_TABLE[key], counter, (c, r) => {
		RAM[c + PAGE_TABLE[key][0]*16][r].recolor(selected ? 'lightblue' : '#00FF00');
		counter --;
		return counter;
	});
}

/* -------------------- PROCESSOR -------------------- */
//bare bones processor class (change this to do whatever you had in mind)
class processor {
	constructor (){
		this.time = get_time();
		this.queue = [];
	}
	
	add_process(){
		PRGM = document.getElementById("programs");
		var process = PRGM.value;
		for (i=0;i<np_arr.length;i++) {
			if (process == String(np_arr[i])) {
				this.queue.push(np_arr[i]);
				this.run();
			}
		}
		
	}
	
	run(){
		//FIFO
		add_log("Run " + this.queue[0].name);
		
		this.queue[0].p_run();
		
		add_log("Complete " + this.queue[0].name);
		
	}
}

/* -------------------- PROCESSES -------------------- */
class process {
	constructor (data, func){
		//function passed that will execute a series of operations on data
		this.func = func;
		//Array of processes for memory management and execution
		PROCESSES.push(this);
		
		//log of memory in use
		this.activeVM = [];
		//init active memory
		this.p_load(data);
		
		//last time the process did something
		this.lastAccess = new Date();
	}	
	
	p_load(data){
		//loads data into RAM and VM (also handles shifting of memory to make room)
		
		//load the data and get the vm_addr
		var vm_addr = loadData(data);
		//keep a log of active memory
		this.activeVM.push([vm_addr, data.length]);
		
		ALL_MEMORY[vm_addr] = data.length;
	}
	
	p_delete(mem_loc, start, length){
		eraseMemory(mem_loc, start, length);
	}
	
	p_write(mem_loc, start, data){
		
	}
	
	p_swap(mem_loc, dataToSwap, dataSwapped) {
		//Takes two strings and swaps them out, the first being swapped in, the second being taken out of the memory location.
		var check = readMemory(mem_loc, 0, mem_loc.length);
		var start = check.indexOf(dataSwapped);
		if (!start) {
			return "String not found in memory";
		} else{
			var len = dataToSwap.length;
			writeMemory(mem_loc, start, len);
		}
	}
	
	p_copy_by_ref(mem_loc, start, length){
		//copy the Virtual memory but not the RAM
		var check = this.p_read(mem_loc, start, length);
		if (!check) {
			return "No data found";
		} else {
			return check;
		}
		
	}
	
	p_copy_by_value(mem_loc, start, length){
		//copy the virtual and RAM 
		var check = this.p_read(mem_loc, start, length);
		if (!check) {
			return "No data found";
		} else {
			return check;
		}
	}
	
	p_read(mem_loc, start, length){
		//load data from somewhere in memory
	}

	p_create_pte(length, data) {
		//creates page tables split into sections of 32, with the starting memory position, ending position and the length of the page table.
		var counter = 0;
		var pte_arr = [];
		var mem_choice = RAM;
		for (i=0;i<data.length;i++) {
			counter += 1;
		}
		var dataBreak = Math.round(counter / 2);
		var numOfPTE = Math.ceil(counter / length);
		counter = 0;
		for (x=0;x<numOfPTE.length;x++) {
			var temp = x;
			var name = ("pte" + x);
			name = {mem_loc:mem_choice, mem_start:counter, mem_end:(counter + numOfPTE), length:numOfPTE};
			counter += numOfPTE;
			if (counter>=dataBreak) {
				mem_choice = DISK;
			}
			pte_arr.push(name);
		}
		console.log(pte_arr);

	}

	p_run() {
		//Begins by checking which process was clicked to run, then creates page tables and moves the data to RAM or Disk.
		for (i=0;i<this.length;i++) {
			var checker = checker += i;
		}
		switch (checker){
			case "program1":
				this.p_create_pte(32, "Welcome to Virtual Memory Simulator");
				break;
			case "program2":
				this.p_create_pte(32, "Virtual memory is split into page table entries");
				break;
			case "program3":
				this.p_create_pte(32, "Page table entries track the locations on RAM and the Disk");
				break;
			case "program4":
				this.p_create_pte(32, "Data is swapped in and out of the disk and RAM");
				break;
			case "program5":
				this.p_create_pte(32, "We wish you a Merry Christmas");
				break;
		}
	}
}

/* -------------------- MEMORY -------------------- */

function init_visual_memory(){	
	//get canvas contexts to draw
	var vm_ctx = document.getElementById("canvas_vmem").getContext("2d");
	var ram_ctx = document.getElementById("canvas_ram").getContext("2d");
	var dsk_ctx = document.getElementById("canvas_disk").getContext("2d");
	
	var size = 23;
	var offset = 5;
	
	//VM 64x8 grid
	for (var x = 0; x < 65; x++){
		for (var y = 0; y < 9; y++){
			if((x != 0) && (y != 0)){
				VM[x-1][y-1] = new canvas_memory(x, y, size, offset, false, vm_ctx);
			}else{
				new canvas_memory(x, y, size, offset, false, vm_ctx);
			}
		}
	}
	//RAM 64x4 grid
	for (var x = 0; x < 65; x++){
		for (var y = 0; y < 5; y++){
			if((x != 0) && (y != 0)){
				RAM[x-1][y-1] = new canvas_memory(x, y, size, offset, true, ram_ctx);
			}else{
				new canvas_memory(x, y, size, offset, true, ram_ctx);
			}
		}
	}
	for (var p = 0; p < 4; p++){
		
		//draw boxes for Page Table Headings
		ram_ctx.strokeStyle = "#0000FF";
		ram_ctx.beginPath();
		//simplify formula
		//((p*16)+1) * (size + offset) + (offset * ((2*p)+1)) = 16*p*size + 18*p*offset + 2*offset + size
		var start_x = 16*p*size + 18*p*offset + 2*offset + size;
		var width = (size*16) + (offset*15);
		ram_ctx.rect(start_x, offset, width, size);
		ram_ctx.stroke();
		
		//write Page Table 
		ram_ctx.fillStyle = "#000000";
		ram_ctx.font = "18px Serif";
		ram_ctx.fillText("Page Table " + p, start_x - (12*4)+ width/2, size);
		
	}
	
	//DISK 16x16 grid
	for (var x = 0; x < 17; x++){
		for (var y = 0; y < 17; y++){
			if((x != 0) && (y != 0)){
				DISK[x-1][y-1] = new canvas_memory(x, y, size, offset, false, dsk_ctx);
			}else{
				new canvas_memory(x, y, size, offset, false, dsk_ctx);
			}
		}
	}
	
}

class canvas_memory {
	
	constructor(x, y, size, offset, pages, ctx){
		//Memory use
		this.hasData = false;
			
		//Graphics
		this.x = x;
		this.y = y;
		this.size = size;
		this.ctx = ctx;
		
		//default unless overwritten
		this.xPos = x*size + (x+1)*offset;
		this.yPos = y*size + (y+1)*offset;
		//simplified formula		
		//x * (size + offset) + offset = x*size + (x+1)*offset
		
		if(pages){
			//simplify formula
			//y * (size + offset) + (2*offset) + size = (y+1)*size + (y+2)*offset
			this.yPos = (y+1)*size + (y+2)*offset;
			if(x != 0){
				//simplify formula
				//x * (size + offset) + (offset * ((2*Math.floor((x-1)/16))+1))
				this.xPos = x*size + (x + 1 + (2*Math.floor((x-1)/16)))*offset;
			}
		}

		//draw on screen
		this.init();
	}
	
	init(){	
		//Boxes
		if(!(this.x == 0) != !(this.y == 0)) { //0,x or x,0 not 0,0
			this.ctx.fillStyle = "#FFFFFF";
			this.ctx.beginPath();
			this.ctx.rect(this.xPos, this.yPos, this.size, this.size);
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
			this.ctx.fillRect(this.xPos, this.yPos, this.size, this.size);
		}
	}
	
	fill(c, str){
		this.color(c);
		this.write(str);
	}
	
	write(str){
		this.hasData = true;
		this.data = str;
		//Write text (1 or 2 chars) in box
		this.ctx.fillStyle = "#000000";
		this.ctx.font = "18px Serif";
		
		if(str.length > 1){
			this.ctx.fillText(str, this.xPos + 3, this.yPos + 17);
		}else{
			this.ctx.fillText(str, this.xPos + 7, this.yPos + 17);
		}
	}
	
	recolor(c){
		this.color(c);
		this.write(this.data);
	}
	
	color(c){
		this.hasData = false;
		//color box
		this.ctx.clearRect(this.xPos, this.yPos, this.size, this.size);
		this.ctx.fillStyle = c;
		this.ctx.fillRect(this.xPos, this.yPos, this.size, this.size);
	}
}
