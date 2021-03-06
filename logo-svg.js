jQuery(document).ready(function($) {

  LS.initialize();

});

Class = function(methods) {   
  var klass = function() {    
    this.initialize.apply(this, arguments);          
  };  
  
  for (var property in methods) { 
    klass.prototype[property] = methods[property];
  }
        
  if (!klass.prototype.initialize) klass.prototype.initialize = function(){};      
  
  return klass;    
};

// Logo code block storage
Block = Class({
  initialize: function(name,template) {
    this.name = name;
    this.template = template;
    this.cmds = [];
  }
})

var LS = {

  x: 300,
  y: 300,
  angle: -90,
  cmds: [],
  functions: [], // user defined function instances. Global scope only.
  functionDefinitions: {}, 
 
  initialize: function() {
    draw = SVG('svg').size(600, 600)
  },

  cleanArray: function(array) {
    var newArray = [];
    for (var i = 0; i < array.length; i++) {
      if (array[i] != "") newArray.push(array[i]);
    }
    array = newArray;
    return array;
  },

  // runs a whole program
  run: function(program) {
    // turn newlines into spaces
    // pad '[]' w extra spaces
    program = program.replace(/\n/g,' ')
                     .replace(/\[/g,' [ ')
                     .replace(/\]/g,' ] ')
    // downcase here
    this.cmds = this.cmds.concat(this.parse(program));
    // run pre-processed program, which is now a flattened array 
    // of executable statements with no blocks
    while (this.cmds.length > 0) {
      var cmd = this.cmds.shift();
      if (cmd.length > 0) {
        var keyword = cmd[0];
            args = cmd;
        this.commands[keyword].apply(this,[args]);
      }
    }
  },

  // parses a string of code
  parse: function(string) {
    var cmds  = [],
        blocks = [], // blocks need not be known outside the parse context
        words = this.cleanArray($.trim(string).split(' '));
    // sort each word
    for (var i = 0; i < words.length; i++) {
      var word = $.trim(words[i]);

      /* =======================
       * We're in a user function call
       * =======================
       */
      if (this.functions.length > 0 
       && this.functions[0].argCount != 0) { // and we still need args
        var f = this.functions[0];
        f.args.push(word);
        f.argCount -= 1;
        // run the function if it needs no new args
        if (f.argCount == 0) {
          cmds = cmds.concat(this.parse(f.generate(f.args)));
          // remove function instance upon completion
          this.functions.shift();
        }

      /* =======================
       * We're in a block (a loop or function)
       * =======================
       */
      } else if (blocks.length > 0) { // we're in a block 
        var block = blocks[0];
        block.cmds.push(word);
        // if the word is the recognized terminator 
        // for this block type
        if (word == block.template.terminator) {
          // end the block and run it with its args
          cmds = cmds.concat(
            block.template.f.apply(
              this,[block.cmds]
            )
          );
          blocks.shift();
        }

      /* =======================
       * New blocks
       * =======================
       * detect if a code block is about to begin,
       * by comparing to our list of block keywords
       */
      } else if (this.blockCommands.hasOwnProperty(word)) {
        // create a place to store the statements in this block
        blocks.push(new Block(word,this.blockCommands[word]));

      /* =======================
       * New calls to user functions
       * =======================
       * detect if a user function is about to begin,
       * by comparing to our list of user function keywords
       */
      } else if (this.functionDefinitions.hasOwnProperty(word)) {
        // Make an instance of the user function.
        // Add arguments to it. Then run .generate() when
        // it has the correct # of arguments, which
        // returns a cmds array, which we copy into
        // the cmds array
        this.functions.unshift({
          args: [],
          argCount: this.functionDefinitions[word].args.length,
          template: this.functionDefinitions[word],
          // used in functions only:
          generate: function(args) {
            var newCmds = [];
            this.template.cmds = LS.cleanArray(this.template.cmds);
            // Parse out variables and replace them
            for (var i = 0; i < this.template.cmds.length; i++) {
              var matched = false, match;
              for (var j = 0; j < this.template.args.length; j++) {
                
                if (this.template.cmds[i] == this.template.args[j]) {
                  matched = true;
                  match = j;
                }
              }
              if (matched) {
                // replace variable:
                newCmds.push(args[match]);
              } else {
                // copy into generated cmds:
                newCmds.push(this.template.cmds[i]);
              }
            }
            // re-join into string for parsing; inefficient
            // parser should accept arrays too
            return newCmds.join(' ');
          }
        });

      /* =======================
       * New statements
       * =======================
       * it matches a recognized command
       */
      } else if (this.commands.hasOwnProperty(word)) { 
        // create a new command
        cmds.push([word]);

      /* =======================
       * Add word to previous statement
       * =======================
       */
      } else {
        // add it to the last statement
        if (word != "") cmds[cmds.length-1].push(word);
      }

    }
    return cmds;
  },

  radians: function(angle) {
    return angle / 180 * Math.PI;
  },

  blockCommands: {
    "REPEAT": {
      type: "REPEAT",
      terminator: ']', 
      f: function(args) {
        var reps = parseInt(args.shift()),
            cmds = [];
        // remove brackets
        args = args.splice(1,args.length-2);
        // re-add spaces for parsing
        var string = args.join(' ');
        // add to main cmds array
        for (var i = 0; i < reps; i++) {
          cmds = cmds.concat(this.parse(string));
        }
        return cmds;
      }
    },
    "TO": {
      type: 'function', 
      terminator: 'END', 
      f: function(args) {
        var f = {
          cmds: [],
          args: []
        }
        var name = args.shift();
        // remove terminating "END"
        var terminator;
        while (terminator != "END") {
          terminator = args.pop();
        }
        var constructor = true;
        // read args into args array until they run out, 
        // then copy remainder into cmds array
        for (var i = 0; i < args.length; i++) {
          // if it's a function argument, which start with ":"
          // and if we are still in the constructor portion of
          // the function declaration
          if (args[i][0] == ":" && constructor) {
            // store it in the arguments array
            f.args.push(args[i]);
          } else {
            constructor = false;
            f.cmds.push(args[i]);
          }
        }
        // add self to global context;
        // overwrites old definition if exists
        this.functionDefinitions[name] = f;
        return [];
      }
    }
  },

  commands: {
    "SETX": function(args) {
      this.x = parseFloat(args[1]);
    },
    "SETY": function(args) {
      this.y = parseFloat(args[1]);
    },
    "SETXY": function(args) {
      this.x = parseFloat(args[1]);
      this.y = parseFloat(args[2]);
    },
    "LT": function(args) {
      this.angle -= parseFloat(args[1]);
    },
    "RT": function(args) {
      this.angle += parseFloat(args[1]);
    },
    "LEFT": function(args) {
      this.angle -= parseFloat(args[1]);
    },
    "RIGHT": function(args) {
      this.angle += parseFloat(args[1]);
    },
    "FORWARD": function(args) {
      this.crawl(args[1]);
    },
    "FW": function(args) {
      this.crawl(args[1]);
    },
    "BACKWARD": function(args) {
      this.crawl(-args[1]);
    },
  },

  crawl: function(d) {
    var newx = this.x + d * Math.cos(this.radians(this.angle));
    var newy = this.y + d * Math.sin(this.radians(this.angle));

    draw.line(this.x, this.y, newx, newy).stroke({ width: 1 })

    this.x = newx;
    this.y = newy;
  },

  download: function() {
    var svg = $('svg')[0];
    var serializer = new XMLSerializer();
    var svg_blob = new Blob([serializer.serializeToString(svg)],
                            {'type': "image/svg+xml"});
    var url = URL.createObjectURL(svg_blob);
    var lnk = document.createElement("a");

    lnk.href = url;
    lnk.download = prompt('Enter a filename','logo.svg');

    if (document.createEvent) {
      event = document.createEvent("MouseEvents");
      event.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
      lnk.dispatchEvent(event);
    } else if (lnk.fireEvent) {
      lnk.fireEvent("onclick");
    }

  }

}
