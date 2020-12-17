//Globals
var LOG, PRGM, PT;
var Processor = {};
var ALL_MEMORY = {};
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
	
	//Init canvas printing
	init_visual_memory();
	
	
	Swap = new process("VM Swap", (p, step) => {
		switch(step){
			case 0:
				add_log("Writing Data to Memory: Variable 1");
				p.vm_data1 = "Variable 1";
				p.vm_addr1 = loadData(p.vm_data1);
				p.vm_coord1 = addr_to_coord(p.vm_addr1);
				break;
			case 1:
				add_log("Writing Data to Memory: Variable 2");
				p.vm_data2 = "Variable 2";
				p.vm_addr2 = loadData(p.vm_data2);
				p.vm_coord2 = addr_to_coord(p.vm_addr2);
				break;
			case 2:
				add_log("Copying Data: Variable 1");
				p.tmp_addr = copy_by_value(VM, p.vm_coord1, p.vm_data1.length);
				p.vm_coord_tmp = addr_to_coord(p.tmp_addr);
				add_PT_entry(p.tmp_addr, PAGE_TABLE[p.vm_addr1]);
				break;
			case 3:
				add_log("Erasing Data: Variable 1");
				eraseMemory(VM, p.vm_coord1, p.vm_data1.length);
				remove_PT_entry(0);
				break;
			case 4:
				add_log("Coping Data: Variable 2");
				moveMemory(VM, p.vm_coord1, p.vm_coord2, p.vm_data2.length);
				p.tmp_addr = PAGE_TABLE[p.vm_addr1];
				add_PT_entry(p.vm_addr1, PAGE_TABLE[p.vm_addr2]);
				break;
			case 5:
				add_log("Erasing Data: Variable 2");
				eraseMemory(VM, p.vm_coord2, p.vm_data2.length);
				remove_PT_entry(0);
				break;
			case 6:
				add_log("Coping Data: Variable 1");
				moveMemory(VM, p.vm_coord2, p.vm_coord_tmp, p.vm_data1.length);
				add_PT_entry(p.vm_addr2, p.tmp_addr);
				break;
			case 7:
				add_log("Erasing Data: Temp");
				eraseMemory(VM, p.vm_coord_tmp, p.vm_data1.length);
				remove_PT_entry(0);
				break;
			case 8:
				add_log("Program Swap Completed.");
				break;
		}
	});
	
	
	Greedy = new process("Fill RAM", (p, step) => {
		if(step < 25){
			let random_string = Math.random().toString(36).substring(7) + Math.random().toString(36).substring(7);
			add_log("Writing Data to Memory: " + random_string);
			loadData(random_string);
		}
	});
	//we can print to any memory location
}

/* -------------------- HELPER FUNCTIONS -------------------- */
function loadData(data){	
	//put data into RAM (address 8 bits)
	var RAM_address = writeMemory(RAM, data);
	
	//put data into RAM (address (page, offset))
	var VM_address = writeMemory(VM, data);
	
	//add entry for data length
	ALL_MEMORY[VM_address] = data.length;
	
	//add page table entry
	add_PT_entry(VM_address, RAM_address);
		
	//return the VM address
	return VM_address;
}

function moveMemory(mem_loc, dest, src, len){
	var data = readMemory(mem_loc, src, len).split('');
	strictWrite(mem_loc, dest, data)
}

function strictWrite(mem_loc, dest, data){
	navigate(mem_loc, dest, data.length, (c, r) => {
		//write to VM
		mem_loc[c + ((mem_loc === RAM) ? (dest[0]*16) : 0)][r].fill("#00FF00", data[0]);
		//remove letter
		data.shift();
		return data.length;
	});
}

function copy_by_value(mem_loc, coord, len){
	var data = readMemory(mem_loc, coord, len);
	return writeMemory(mem_loc, data);
}

function eraseMemory(mem_loc, start, len){
	//clear memory
	navigate(mem_loc, start, len, (c, r) => {
		mem_loc[c + ((mem_loc === RAM) ? (start[0]*16) : 0)][r].color("#000000");
			len --;
		return len;
	});
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
			return coord_to_addr(start, mem_loc);
		}
	}else{
		switch(mem_loc){
			case RAM:
				//move memory out to DISK (addr, len)
				vm_loc = analyzeMemory(len);
				console.log(vm_loc);
				//log process
				add_log("Moving data from RAM to Disk");
				
				//move data to DISK from RAM (and erase the RAM)
				//PAGE_TABLE[ram_loc[0]] is string not start
				shiftToDISK(vm_loc, PAGE_TABLE[vm_loc], ALL_MEMORY[vm_loc]);
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
		//assume oldest memory is earliest entry on PT
		//get PT key of first entry
		key = PT.children[1].value.split(" || ")[0];
		remove_PT_entry(0);
		return key;
	}else{
		//No room to put new data
		add_log("Error: Insufficient Memory");
		return null;
	}
}

function shiftToDISK(vm_loc, start, len){
	data = readMemory(RAM, start, len);
	var disk_addr = writeMemory(DISK, data);
	eraseMemory(RAM, start, len);
	add_PT_entry(vm_loc, disk_addr);
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
	if(typeof(ram_addr) == typeof([])){
		//reformat ram display
		ram_addr = coord_to_addr(ram_addr, RAM);
	}
	//print to table
	PT.innerHTML += "<option onmouseup='recolorMem(true)' onmousedown='recolorMem(false)'>" + vm_addr + " || (" + ram_addr + ")</option>";
}

function remove_PT_entry(key, index){
	//remove Page Table entry by index
	delete PAGE_TABLE[key];
	PT.remove(index);
}

function add_program(text){
	//add program to list
	PRGM.innerHTML += "<option onclick='runProgram(\"" + text + "\")'>" + text + "</option>";
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
	if(key){
		//color RAM or DISK
		counter = ALL_MEMORY[key];
		if(typeof(PAGE_TABLE[key]) == typeof([])){
			navigate(RAM, PAGE_TABLE[key], counter, (c, r) => {
				RAM[c + PAGE_TABLE[key][0]*16][r].recolor(selected ? 'lightblue' : '#00FF00');
				counter --;
				return counter;
			});
		}else{
			
			navigate(DISK, addr_to_coord(PAGE_TABLE[key]), counter, (c, r) => {
				DISK[c][r].recolor(selected ? 'lightyellow' : '#00FF00');
				counter --;
				return counter;
			});
		}
		//color VM
		counter = ALL_MEMORY[key];
		coord = [parseInt(key, 16) % 64, Math.floor(parseInt(key, 16) / 64)];
		navigate(VM, coord, counter, (c, r) => {
			VM[c][r].recolor(selected ? 'pink' : '#00FF00');
			counter --;
			return counter;
		});
	}
}

function coord_to_addr(coord, mem_loc){
	console.log(coord, mem_loc.length);
	if(coord.length == 3){
		return coord[0] + ", " + zeroPad((coord[2]*16 + coord[1]).toString(16), 2);
	}else{
		return "0x" + zeroPad((coord[1]*mem_loc.length + coord[0]).toString(16), 2)
	}
}

function addr_to_coord(addr, mem_loc){
	if(mem_loc !== RAM){
		return [parseInt(addr, 16) % 64, Math.floor(parseInt(addr, 16) / 64)];
	}else{
		return null;
	}
}

/* -------------------- PROCESSOR -------------------- */

function runProgram(key){
	Processor[key].run();
}

/* -------------------- PROCESSES -------------------- */
class process {
	constructor (name, func){
		//function passed that will execute a series of operations on data
		this.name = name;
		this.func = func;
		//Array of processes for memory management and execution
		Processor[name] = this;
		add_program(name);
			
		//last time the process did something
		this.lastAccess = new Date();
		this.step = 0;
	}	
	
	run(){
		this.func(this, this.step++);
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
