/*
 * Visuomotor rotation (VMR) plug-in 
 */ 

jsPsych.plugins["wjs-tracking"] = (function() {

  var plugin = {};

  plugin.info = {
    name: "wjs-tracking",
    parameters: {  // Define all input parameters and their corresponding default values
      traj_index: {
        type: jsPsych.plugins.parameterType.INT, 
        pretty_name: "Trajectory index",
        default: 0,
        description: "Index of trajectory to present"
      },
      path_width: {
        type: jsPsych.plugins.parameterType.INT, 
        pretty_name: "Path width",
        default: 80,
        description: "Path width in pixels"
      },
      pre_time: {
        type: jsPsych.plugins.parameterType.INT, 
        pretty_name: "Preparation Time",
        default: 1,
        description: "Preparation Time in seconds"
      },
      bonus: {
        type: jsPsych.plugins.parameterType.INT, 
        pretty_name: "bonus",
        default: 0,
        description: "total bonus"
      },
      path_load: {
        type: jsPsych.plugins.parameterType.OBJECT, 
        pretty_name: "path",
        default: true,
        description: "pre-generated path"
      },
      bar_pass: {
        type: jsPsych.plugins.parameterType.BOOL, 
        pretty_name: "draw shooter",
        default: true,
        description: "draw the shooter at the top?"
      },
      home_radius: {
        type: jsPsych.plugins.parameterType.INT,
        pretty_name: "Home radius",
        default: 20,
        description: "Home radius in pixels"
      },
      home_location: {
        pretty_name: "Home location",
        type: jsPsych.plugins.parameterType.INT, 
        default: [0.5*window.screen.availWidth, 0.5*window.screen.availHeight],
        array: true,
        description: "x and y coordinates of home position in pixels"
      },
      cursor_radius: {
        type: jsPsych.plugins.parameterType.INT, 
        pretty_name: "Cursor radius",
        default: 6,
        description: "Cursor radius in pixels"
      },
      cursor_color: {
        type: jsPsych.plugins.parameterType.STRING, 
        pretty_name: "Cursor color",
        default: [255,255,255],
        description: "Cursor color"
      },
      home_color: {
        type: jsPsych.plugins.parameterType.STRING, 
        pretty_name: "Home color",
        default: [0,70,180],
        description: "Home color"
      },
      movement_time:{
        type: jsPsych.plugins.parameterType.INT, 
        pretty_name: "movement time",
        default: 20,
        description: "time of a trial (in s)"
      },
      feedback_dur:{ // for warning messages in miss trials
        type: jsPsych.plugins.parameterType.INT, 
        pretty_name: "Feedback duration",
        default: 300,
        description: "Feedback duration (in ms)"
      },
      background_color: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: "Background color",
        default: "black",
        description: "Screen background color"
      },
      demo_trial: { // demo trial: slowed-down trial, showing instructions for each step on screen
        type: jsPsych.plugins.parameterType.BOOL,
        pretty_name: "Demo trial",
        default: false,
        description: "Demo trial? (true/false)"
      }
    }
  };

	// BEGINNING OF TRIAL 
  plugin.trial = function(display_element, trial) 
  {
    wjs_trial_number++; // Increment global trial number.
    var trial_number = wjs_trial_number; // Local value for trial number.

    if( wjs_trial_preview_flag ) // Previewing the trial-listy, so end the trial and return.
    {
      jsPsych.finishTrial(trial);
      return(plugin);
    };

    wjs_debug_log(`plugin=${trial.type}: start wjs_trial=${trial_number}`);
    wjs_debug_log(trial);

    var TrialTimer = new wjs_timer('TrialTimer');
    TrialTimer.Reset();

    var availDis; // 0.75*wjs.canvas.height;
    centerXY = new wjs_xy; // = x = wjs.canvas.width / 2, y = wjs.canvas.height / 2;

    // Setup the canvas for display (including local canvas update function).
    wjs_canvas_setup(display_element,trial.type,updateCanvas,trial.background_color);

    // Initialize new variables for the current trial.

    var home = {
      x: trial.home_location[0], // always center the home position
      y: trial.home_location[1],
      radius: trial.home_radius,
      colorRGB: trial.home_color,
      fadeColorRGB: trial.home_color.map(x => Math.round(x * 0.5)),
      colorNowRGB: null
    };

    var cursor = {
      x: Number.isNaN(wjs.cursor.x) ? home.x : wjs.cursor.x,
      y: Number.isNaN(wjs.cursor.x) ? home.y : wjs.cursor.y,
      velocity: { x:0,y:0 },
      display: { x:0,y:0 },
      speed: 0,
      radius: trial.cursor_radius,
      colorRGB: [255, 255, 255],
      colorOutRGB: [192, 0, 0],
      fadeColorRGB: trial.cursor_color.map(x => Math.round(x * 0.5 )),
      speed_thresh: 10, // speed threshold for atTarget and atHome
      distanceToHome: 0,
      atHome: 0,
      outPath: 0
    };

    // parameters of GO timer
    var countDownTime = 2000;

    // bonus money
    var bonus = 0;

    // Parameters of the path
    // var outTime = [];
    var Xcurr = [];
    var Path = {
        y: [],
        y_u: [],
        y_l: [],
        dx: [],
        yt1: 0,// step number at the bottom 
        yt2: 0,// step number at the top
        yt1_plot:0,
        yt2_plot:0,
        colorRGB: [105, 105, 105],
        colorOutRGB: [255, 105, 105],
        dly: [], //(pix) 1.1cm
        dlx: [], //(pix)
        Time: [], //(s)
        Speed: [], //(pix/s)
        Steps: [],
        Xlim: wjs.canvas.width/4,//pix
        Width: trial.path_width,
        WidthDisplay: [],
        preTime: trial.pre_time,//pre-view time (s)
        Points:0,
        Score:0,
        afterTime: [],
        Hit:[]
    };
    
    var lastDot = -1;

    // Load Path
    var Path_load = [];
    eval('Path_load  = trial.path_load.x'+trial.traj_index);
    Path.Time = Path_load.Time; //(s) max is 30
    Path.Speed = Path_load.Speed;//availDis/maxavailTime; //(pix/s)
    Path.preTime = Path_load.preTime;
    Path.afterTime = Path_load.afterTime;
    Path.WidthDisplay = 0.5*Path.Width;

    if(trial.demo_trial){
      Path.Speed =  Path.Speed/2;//availDis/maxavailTime/2;
      Path.preTime = 2;
      Path.afterTime = 2;
      Path.Width = 50;
      Path.WidthDisplay = 50;
      // availDis = Path.preTime*Path.Speed;
      Path.Time = 10;

    }

    // adjust dlx with availDis
    var ratio_w = wjs.canvas.width<1200 ? availDis/600 : 1;
    Path.dlx = Math.round(Path_load.dly*ratio_w); //(pix) 1.1cm
    Path.Speed = Path.Speed*ratio_w;
    Path.Steps = Math.round(Path.Time*Path.Speed/Path.dlx)+1;
    // console.log(Path.Steps);
    // adjust PathY and width and path_width if canvasWidth<600
    var PathY = Path_load.x.slice(0,Path.Steps);
    if(trial.demo_trial){
      PathY = PathY.map(x => x*0.5);
    }
    if(wjs.canvas.height < 600){
      PathY = PathY.map(x => x*wjs.canvas.height/600); 
      Path.Width = trial.path_width*wjs.canvas.height/600;
      // cursor.radius = cursor.radius*wjs.canvas.height/1200;
    }
    PathY = PathY.map(x => x + trial.home_location[1]); 

    // generate PathY
    var PathX = new Array(Path.Steps).fill(NaN);
    PathX[0] = trial.home_location[0];
    for(var i = 1; i <= Path.Steps-1; i++){ // for each step(i)
      PathX[i] = PathX[i-1] + Path.dlx;
    }

    Path.y = PathY;
    Path.x = PathX;
    Path.Hit = new Array(Path.Steps).fill(1);
    Path.y_u = PathY.map(x => x - Path.Width/2);
    Path.y_l = PathY.map(x => x + Path.Width/2);
    Path.dx = Path.dlx;
    var delta_yt = Math.floor(Path.afterTime*Path.Speed/Path.dx);//plot under home position
    var trace_x = [], trace_time = [], trace_y = [], y_ = [], horizon = [];

    // load basket and ball image
    var hit = new Image, miss = new Image;
    hit.src = 'images/hit.png';
    miss.src = 'images/miss.png';
    // var scale = Path.Width/534, ball_w = 484, ball_l = 438;
    // var scaleShooter = (trial.home_location[0]-availDis)/359;
    
    // WJS needs to know home position and radius for pointer-lock target.
    wjs_xy2xy(wjs.home,home); // Set x,y position of home in global WJS object.
    wjs.home.radius = home.radius;
    
    // Initialize variables to be saved in every trial
    var data = {
      RT: null,
      MT: null,
      xArray: [],
      yArray: [],
      tArray: [],
      timeArray: [],
      stateArray: [],
      missTrial: false,
      missTrialMsg: '',  // accumulate miss trial messages
      fullScreenExitTime: [], // time stamps for full-screen exit (if any)
      resizeTime: [], // time stamps for window size change (if any)
      Path: []
    };
    
    wjs_trial_feedback_clear(); 
    instructionText = '';
    
    // Start trial in the initial state (and set the frame update function).
    State.Start(writeFrameData);

    // Start mouse and other event handlers (including local functions).
    wjs_event_start(eventCursorMove,eventCursorUpdate,eventResize,eventPointerlockChange); 
    // window.onresize = eventResize;
    // eventCursorUpdate(); // Immediately update cursor so it follows smoothly between trials.

    // Start the main loop for the trial (with local processing functions defined below).
    wjs_main_loop(calc_func,state_process,display_func,end_trial);

    /******************************************************************************/
    
    function calc_func() 
    {
      wjs_canvas_update('loop'); 

      // 2D cursor velocity
      cursor.speed = wjs_distance(cursor.velocity); // Magnitude of vector.
      wjs_xy2xy(cursor.velocity,[ 0,0 ]); // Reset velocity to 0 (set by mouse event handler).

      // Compute distances based on the displayed cursor position
      cursor.distanceToHome = wjs_distance(cursor.display,home);
      cursor.atHome = wjs_ishome(cursor.display,home,home.radius-cursor.radius) && (cursor.speed < cursor.speed_thresh);
      cursor.outPath = cursorOutPath();
    }; // calc_func()

    /******************************************************************************/

    function state_process() 
    {
      var ExitFlag=false;

      // Full-screen and pointer lock flags.
      var FS = wjs_fullscreen_flag();
      var PL = wjs_pointerlock_flag();

      // Check full-screen and pointer-lock if not alreday in one of these states.
      if( (State.Current !== State.FULL_SCREEN) && (State.Current !== State.POINTER_LOCK) &&  !(FS && PL) )
      {
        wjs_xy2xy(wjs.mouse,[0,0]); // Reset mouse position.

        if( !FS ) // First, process full-screen.
        {
          wjs_fullscreen_enter();
          State.Push(State.FULL_SCREEN); // Go to FULL_SCREEN state, saving the current state.
        } 
        else if( !PL ) // If full-screen, check pointer-lock.
        {
          State.Push(State.POINTER_LOCK); // Go to POINTER_LOCK state, saving the current state.
        };
      };     

      switch (State.Current)
      {
        case State.START:
          wjs.trial_feedback_text = 'Move to the blue circle.';
          if (cursor.atHome){ // If the cursor is at home
            wjs.trial_feedback_text = '';
            State.Next(State.GO); // advance
          }
          break;
          
      case State.GO:
        if (cursor.atHome){
            wjs.trial_feedback_text = '';
        }else if(!State.ExpiredMSec(countDownTime+200) && !cursor.atHome){
            wjs.trial_feedback_text = 'Go back and wait.';
            State.Next(State.START); // go back
        }
        if(State.ExpiredMSec(countDownTime+200)){
            State.Next(State.MOVING); // advance
        }
        break;
  
      case State.MOVING:
        var t = State.ElapsedSec(); // sec
        Xcurr =  Path.x.map(x => x - t*Path.Speed+availDis);
        Path.yt1 = Math.max(0,Math.floor((t*Path.Speed-availDis)/Path.dx));
        // Path.yt2 = Math.min(Math.floor(Xcurr[Path.yt1]/Path.dx)+Path.yt1,
        //                     Math.floor(Path.Speed*(Path.preTime+Path.afterTime)/Path.dx)+Path.yt1)+1;

        Path.yt1_plot = Math.max(0,Path.yt1-delta_yt-1);// plot extra delta_yt under the home position
        Path.yt2_plot = Math.floor(Path.Speed*(Path.preTime+Path.afterTime)/Path.dx)+Path.yt1_plot+1;


        // delete dot
        if(Path.yt1>lastDot && Xcurr[Path.yt1]<home.x){
          lastDot = Path.yt1;
          trace_time = [data.timeArray[data.timeArray.length-1],TrialTimer.ElapsedMSec()];
          trace_x = new Array(trace_y.length).fill(NaN);
          trace_y = [data.yArray[data.yArray.length-1],cursor.y];
          for(var i = 0; i < trace_y.length; i++){
            trace_x[i] = wjs_round((TrialTimer.ElapsedMSec()-trace_time[i])*Path.Speed/1000 + home.x,2);
          }
          y_ = trace_y[1]+(Xcurr[Path.yt1]-home.x)/(trace_x[0]-trace_x[1])*(trace_y[0]-trace_y[1]);
          if(hitDot(y_)){
            Path.Points +=1;
            Path.Score = Path.Points/Path.y.length;
            Path.Hit[Path.yt1] = 0;
          }
        }
        if (State.ExpiredSec(Path.Time+availDis/Path.Speed+0.5)){
          if(trial.data.TrialType =='Timing'||trial.data.TrialType == 'Baseline'){
            if(Path.Score<0.45){
              bonus = 0;
            }else if(Path.Score<0.55){
              bonus = 2;
            }else if(Path.Score<0.65){
              bonus = 4;
            }else if(Path.Score<0.75){
              bonus = 6;
            }else if(Path.Score<0.85){
              bonus = 8;
            }else if(Path.Score<0.90){
              bonus = 9;
            }else{
              bonus = 10;
            }
          }
          State.Next(State.FEEDBACK); // advance
          if(!trial.demo_trial){
            window.addEventListener("keyup",nextTrial,true );
          }
        }
        break;
  
      case State.FEEDBACK: 
        if (trial.demo_trial){
          if (State.ExpiredMSec(trial.feedback_dur)) { // after breif delay
            State.Next(State.FINISH);
          }
        }
        break;
        
      case State.FINISH:
        ExitFlag = true; // Trial over, exit main-loop.
        break;

      case State.FULL_SCREEN :
        if( FS && PL )
        {
          State.Pop();
          break;
        };

        if( FS && !PL )
        {
          State.Next(State.POINTER_LOCK);
        };
        break;

      case State.POINTER_LOCK :
        if( !FS ) // Always do full-screen processing as a priority over pointer-lock.
        {
          wjs_fullscreen_enter();
          State.Next(State.FULL_SCREEN);
          break;
        };

        if( PL )
        {
          State.Pop(); // Return to previous state when POINTER_LOCK triggered.
        };
        break;
      }; 

      return(ExitFlag);
    }; // state_process()

    /******************************************************************************/

    function display_func() 
    {
      if( State.Current == State.FULL_SCREEN )
      { // Nothing to display if waiting for full-screen.
        return;
      };

      // Clear previous drawing within canvas
      wjs.canvas_context.clearRect(0,0,wjs.canvas.width,wjs.canvas.height);
      wjs_frame_count++;  // Increment frame count.

      // Draw home position (if required). 
      if( (State.Current === State.POINTER_LOCK) || (State.Current <= State.GO) )
      {
        home.colorNowRGB = wjs_ishome(wjs.mouse,home,home.radius) ? home.colorRGB : home.fadeColorRGB;
        wjs_draw_circle(home,home.radius,home.colorNowRGB,true,0);
      };
      
      if( State.Current === State.POINTER_LOCK )  
      { // Draw text, then nothing else to do if not in pointer-lock.
        wjs_draw_text([centerXY.x,200],'Click the blue home position to start or resume.',wjs.trial_feedback_size,wjs.trial_feedback_color);
        return;
      };

      // Full-screen and pointer-lock engaged, so display task.

      if( State.Current >= State.FINISH ) { // Nothing else to do if trial finished.
        return;
      };

      // Only show in demo trial
      if(trial.demo_trial){
        countDownTime = 3000;
        if (State.Time < 200 && State.Current !== State.GO) {
          instructionText = ''; // clear text at start of every state, to make change more obvious
        } else {
          if (State.Current<=State.GO){
            if(!cursor.atHome){
              instructionText = 'Move the cursor inside the blue circle to start.';
            }else{
              instructionText = 'Wait until the countdown timer finish.';
            }
          }else if(State.Current>State.GO && State.Current<State.FEEDBACK){
            instructionText = ' Move the white bar and let the curve pass through it.\n The bar will turn red if the curve is outside the bar.';
          }else if(State.Current==State.FEEDBACK){
            instructionText = '';
          }else if(State.Current==State.FINISH) {
            instructionText = '';
          }
        }
      };
      
      // Display the count-down before trial starts.
      if (State.Current === State.GO){
        var t = State.ElapsedMSec();
        if (t < countDownTime){
            wjs_draw_pie([centerXY.x+250,centerXY.y-20],130,0,(countDownTime-t)/countDownTime*360,[255,255,255,0.5]);
            wjs_draw_circle([centerXY.x+250,centerXY.y-20],100,[0, 0, 0],true,2);
        }
        if (t <= Math.round(countDownTime/3)){
          wjs_draw_text([centerXY.x+250,centerXY.y],'3',50-Math.floor(t/30),[255,255,255]);
        }else if (t <= Math.round(countDownTime/3)*2){
          wjs_draw_text([centerXY.x+250,centerXY.y],'2',50-Math.floor((t-Math.round(countDownTime/3))/30),[255,255,255]);
        }else if (t <= countDownTime){
          wjs_draw_text([centerXY.x+250,centerXY.y],'1',50-Math.floor((t-Math.round(countDownTime/3)*2)/30),[255,255,255]);
        }else{
          if(!trial.demo_trial){
            wjs_draw_text([centerXY.x+250,centerXY.y],'Start',40,'white');
          }
        }
      };
      if (State.Current===State.MOVING){
        // draw shooter
        // if (trial.draw_shooter){
        //   if(Path.xt2<Path.x.length){
        //     wjs.canvas_context.drawImage(shooter,Path.x[Path.xt2-1]-349*scaleShooter,horizon-314*scaleShooter,447*scaleShooter,359*scaleShooter);  
        //   }else{
        //     wjs.canvas_context.drawImage(shooter,Path.x[Path.x.length-1]-349*scaleShooter,horizon-314*scaleShooter,447*scaleShooter,359*scaleShooter);  
        //   }
        // }



        // draw the dots
        wjs_draw_line(Xcurr.slice(Path.yt1_plot,Path.yt2_plot+1), 
        Path.y.slice(Path.yt1_plot,Path.yt2_plot+1), [255,192,0], 4);
        wjs_draw_rectangle([0,0],home.x-Path.afterTime*Path.Speed,wjs.canvas.height,[0,0,0]);
        if (State.ExpiredSec((availDis+Path.afterTime*Path.Speed)/Path.Speed)){
          wjs_draw_rectangle([Path.preTime*Path.Speed+home.x,0],
            wjs.canvas.width-home.x-Path.preTime*Path.Speed,wjs.canvas.height,[0,0,0]);
        }
        if (!State.ExpiredSec(availDis/Path.Speed)){
          wjs_draw_line([home.x,Xcurr[Path.yt1_plot]], 
          [Path.y[Path.yt1_plot],Path.y[Path.yt1_plot]], [255,255,255,0.3], 8);
        }
        if (trial.demo_trial){
          wjs.canvas_context.drawImage(hit, home.x-150-50, 20, 150, 120);
          wjs.canvas_context.drawImage(miss, home.x+50, 20, 150, 120);
        }
       
        // for( var i = Path.yt1_plot-1; i < Path.yt2_plot; i++){
        //   if (Path.Hit[i] == 0) {
        //     wjs_draw_circle([Xcurr[i],Path.y[i]],5,[255,192,0],false,2);
        //   }else{
        //     wjs_draw_circle([Xcurr[i],Path.y[i]],5,[255,192,0],true);
        //   }
        // }
      };
      // Display the basket or cursor.
      if(State.Current === State.MOVING){
        
        var color = cursor.outPath ? cursor.colorOutRGB : cursor.colorRGB;
        if (trial.bar_pass == 1){
          wjs_draw_rectangle([home.x-10,cursor.y-Path.WidthDisplay/2],10,Path.WidthDisplay,color);
        }else{
          wjs_draw_rectangle([home.x-10,0],10,cursor.y-Path.WidthDisplay/2,color);
          wjs_draw_rectangle([home.x-10,cursor.y+Path.WidthDisplay/2],10,wjs.canvas.height-cursor.y-Path.WidthDisplay/2,color);
        }


        // wjs.canvas_context.drawImage(ball, 0, (1-Path.Score)*ball_l, ball_w, Path.Score*ball_l, 
        // cursor.x-ball_w*scale/2, home.y-(41-564+Path.Score*ball_l)*scale, 
        // ball_w*scale, Path.Score*ball_l*scale);
        // wjs.canvas_context.drawImage(basket, cursor.x-Path.Width/2, home.y-41*scale, Path.Width, 564*scale);
      }else if(State.Current != State.FEEDBACK){ // cursor the rest of the time
        //var cursorColor = mouse.atLockPos ? cursor.colorRGB : cursor.fadeColorRGB;
        var cursorColor = cursor.ColorRGB;
        wjs_draw_circle(cursor.display,cursor.radius,cursorColor,true);
      };



      if (State.Current==State.FEEDBACK){
        var feedback_x = centerXY.x, feedback_y = centerXY.y;
        // wjs.canvas_context.drawImage(full, feedback_x-ball_w*scalefb/2, feedback_y-(41-564+ball_l)*scalefb, ball_w*scalefb, ball_l*scalefb);
        // wjs.canvas_context.drawImage(ball, 0, (1-Path.Score)*ball_l, ball_w, Path.Score*ball_l, 
        // feedback_x-ball_w*scalefb/2, feedback_y-(41-564+Path.Score*ball_l)*scalefb, 
        // ball_w*scalefb, Path.Score*ball_l*scalefb);
        // wjs.canvas_context.drawImage(basket, feedback_x-widthfb/2, feedback_y-41*scalefb, widthfb, 564*scalefb);
        // wjs_draw_text([feedback_x, feedback_y-150],"You tracked "+Math.round(Path.Score*100) +" % of the curve.",28,'white');
        if(trial.data.TrialType =='Timing'||trial.data.TrialType == 'Baseline'){
          wjs_draw_text([feedback_x, feedback_y-150],"Score: "+Math.round(Path.Score*100) +` %, Bonus: \u{000A2}${bonus}`,28,'white');
          wjs_draw_text([feedback_x, feedback_y],`Total bonus: \u{0024}${wjs_round((bonus+trial.bonus)/100,2)}`,28,[0,190,0]);
        }else{
          wjs_draw_text([feedback_x, feedback_y-150],"You tracked "+Math.round(Path.Score*100) +" % of the curve.",28,'white');
          // wjs_draw_text([centerXY.x+widthfb,centerXY.y],"You caught "+Math.round(Path.Score*100)+"% balls.",28,'white');
        }
        if(State.ExpiredMSec(trial.feedback_dur)){
          wjs_draw_rectangle([centerXY.x-500,centerXY.y+150],1000,100,[255,255,255,0.2]);
          wjs_draw_text([centerXY.x,centerXY.y+210],"Press ANY KEY to continue.",18,[255,255,255]);
        }
      };
          
      // Draw feedback text
      if(!trial.demo_trial){
        wjs_draw_text([centerXY.x,200],wjs.trial_feedback_text,wjs.trial_feedback_size,wjs.trial_feedback_color);
      }else{
        // Draw instruction text in demo trial (don't show feedback text during demo)
        wjs_draw_text([centerXY.x,200],instructionText,wjs.trial_feedback_size,wjs.trial_feedback_color);
      };
    }; // display_func()
    
    //--------------------------------------
	  //---------- HELPER FUNCTIONS ----------
    //--------------------------------------
        
    function updateCanvas()
    {
      trial.home_location[0] = wjs.canvas.width*0.5;
      trial.home_location[1] = wjs.canvas.height*0.5;
      availDis = 0.5*wjs.canvas.width;
      centerXY.x = wjs.canvas.width / 2;
      centerXY.y = wjs.canvas.height / 2;
    };

    function nextTrial(e){
      if(State.ExpiredMSec(trial.feedback_dur)){
        State.Next(State.FINISH);
        window.removeEventListener("keyup",nextTrial,true );
      }
    }

    // Check if cursor is inside the path
    function cursorOutPath(){
      if(State.ExpiredSec(availDis/Path.Speed)){
        var t = State.ElapsedSec(); // sec
        var dpixU = Path.y_u[Path.yt1]+(t*Path.Speed/Path.dx%1)*(Path.y_u[Path.yt1+1]-Path.y_u[Path.yt1]);
        var dpixL = Path.y_l[Path.yt1]+(t*Path.Speed/Path.dx%1)*(Path.y_l[Path.yt1+1]-Path.y_l[Path.yt1]);
        return(cursor.y <= dpixU || cursor.y >= dpixL);
      }else{
        return(false);
      }
    }

    function hitDot(y){
      return(Math.abs(y-Path.y[Path.yt1])<=Path.Width/2);
    }
   
    function writeFrameData()
    {
      if(!Number.isNaN(wjs.cursor.x)){
        // Push cursor kinematic data.
        data.xArray.push(wjs_round(wjs.cursor.x,2));
        data.yArray.push(wjs_round(wjs.cursor.y,2));
        data.tArray.push(wjs_round(wjs.cursor.time_stamp,2)); // Time-stamp for mouse x,y data (msec)
        // Push time & state data.
        data.timeArray.push(wjs_round(TrialTimer.ElapsedMSec(),2)); // msec
        data.stateArray.push(State.Current);
      }

    };
    
    function eventCursorUpdate(event) 
    { // Update local cursor object with global WJS cursor values.
      wjs_xy2xy(cursor,wjs.cursor);                   // cursor = wjs.cursor
      wjs_xy2xy(cursor.velocity,wjs.cursor.velocity); // cursor.velocity = wjs.cursor.velocity
      wjs_xy2xy(cursor.display,cursor);               // cursor.display = cursor

      // Clamp cursor position to canvas size (height is less for progress bar).
      cursor.display.x = wjs_clamp(cursor.display.x,1,wjs.canvas.width);
      cursor.display.y = wjs_clamp(cursor.display.y,0,wjs.canvas.height-54); 
    };

    function eventCursorMove(event)
    { // Update cursor and save frame of data.
      eventCursorUpdate(event);

      if( wjs_fullscreen_flag() ) // Write frame data only if task running in full-screen.
      {
        writeFrameData();
      };
    };

    function eventResize(event) // window resize event handler
    {     
      wjs_miss_trial(data,'windowResize');
      data.resizeTime.push(wjs_round(TrialTimer.ElapsedMSec(),2)); // msec
    };

    function eventPointerlockChange(event)
    {
      if( !wjs_pointerlock_flag() ) 
      {
        wjs_miss_trial(data,'pointerLockDisabled');
        data.fullScreenExitTime.push(wjs_round(TrialTimer.ElapsedMSec(),2)); // msec
      };
    };

    // End trial and save data (pass data to jsPsych).
    function end_trial() 
    {
      wjs_event_stop(); // Stop event handlers.

      display_element.innerHTML=''; // Remove the canvas from the display_element.

      // Place all the data to be saved from this trial in one data object
      var trial_data = { 
        "cursorX": data.xArray, // Cursor x-coordinates
        "cursorY": data.yArray, // Cursor y-coordinates
        "cursorT": data.tArray, // Cursor (mouse) time-stamp
        //"cursorSpeed": data.velArray, // Cursor velocity
        "TrialTime": data.timeArray, // Array of time stamps for each trajectory data point (time point since trial start)
        //"RawTime": data.rawTimeArray,// Raw time stamp
        "State": data.stateArray, // Array of states since go cue
        "nDisplayRefresh": wjs_frame_count, //data.frameRate.length, // Number of frames in this trial    
        //"avgFrameInt": diff(data.timeArray).reduce((total,current) => total + current)/frameID, // Average frame rate of trial  
        "missTrial": data.missTrial, // miss trial (true/false)
        "missTrialMsg": data.missTrialMsg, // miss trial message/type
        "homePos": [home.x, home.y],//trial.home_location,
        "pathSpeed": Path.Speed,
        "pathTime": Path.Time,
        "trajIndex": trial.traj_index,
        "pathWidth": Path.Width,
        "preTime":Path.preTime,
        "afterTime":Path.afterTime,
        "pathPoints": Path.Points,
        "pathdlx": Path.dlx,
        "pathSteps": Path.Steps,
        "availDis": availDis,
        // "pathOutTime": Path.OutSideTime,
        "fullScreenExitTime": data.fullScreenExitTime, // time of full-screen exit (if any)
        "winResizeTime": data.resizeTime, // time of window resize
        "canvCenter": [centerXY.x, centerXY.y],
        "bonus": bonus+trial.bonus
      };

      jsPsych.finishTrial(trial_data); // this function automatically writes all the trial_data
    }; //End of end_trial() function
  }; // End of the plugin's trial() method
  
  return plugin;
})();
