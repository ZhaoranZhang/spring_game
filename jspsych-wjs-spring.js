/*
 * Visuomotor rotation (VMR) plug-in 
 */ 

jsPsych.plugins["wjs-spring"] = (function() {

  var plugin = {};

  plugin.info = {
    name: "wjs-spring",
    parameters: {  // Define all input parameters and their corresponding default values
      bonus: {
        type: jsPsych.plugins.parameterType.INT, 
        pretty_name: "bonus",
        default: 0,
        description: "total bonus"
      },
      obj_size: {
        type: jsPsych.plugins.parameterType.INT, 
        pretty_name: "size of the object",
        default: 70,
        description: "size of the object in pixels"
      },
      obj_ratio: {
        type: jsPsych.plugins.parameterType.FLOAT, 
        pretty_name: "ratio of the object",
        default: 1,
        description: "ratio of the object"
      },
      obj_choice: {
        type: jsPsych.plugins.parameterType.INT, 
        pretty_name: "choice of the object",
        default: 0,
        description: "choice of the object (1/3)"
      },
      pre_time: {
        type: jsPsych.plugins.parameterType.FLOAT, 
        pretty_name: "preparation time",
        default: 1,
        description: "preparation time in sec"
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
        default: [0.25*window.screen.availWidth, 0.5*window.screen.availHeight],
        array: true,
        description: "x and y coordinates of home position in pixels"
      },
      home_color: {
        type: jsPsych.plugins.parameterType.STRING, 
        pretty_name: "Home color",
        default: [0,70,180],
        description: "Home color"
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
      feedback_dur:{ // for warning messages in miss trials
        type: jsPsych.plugins.parameterType.INT, 
        pretty_name: "Feedback duration",
        default: 3000,
        description: "Feedback duration (in ms)"
      },
      background_color: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: "Background color",
        default: "#3f4245",
        description: "Screen background color"
      },
      demo_trial: { // demo trial: slowed-down trial, showing instructions for each step on screen
        type: jsPsych.plugins.parameterType.BOOL,
        pretty_name: "Demo trial",
        default: false,
        description: "Demo trial? (true/false)"
      },
      pra_trial: { 
        type: jsPsych.plugins.parameterType.BOOL,
        pretty_name: "Practice trial",
        default: false,
        description: "Practice trial? (true/false)"
      },
      repeat: { 
        type: jsPsych.plugins.parameterType.BOOL,
        pretty_name: "repeat miss trial",
        default: true,
        description: "repeat miss trial? (true/false)"
      },
      random: { 
        type: jsPsych.plugins.parameterType.BOOL,
        pretty_name: "Random original location",
        default: false,
        description: "objects have random original location? (true/false)"
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

    centerXY = new wjs_xy; // = x = wjs.canvas.width / 2, y = wjs.canvas.height / 2;
    // trial.background_color = '#ebebeb';
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

    // spring
    var spring = {
      part: 16, // part/2 round
      width: 80,
      height: 10,
      D: wjs.canvas.height*0.35,
      angle:[],
      cx: [],
      cy: []
    } 
    spring.cx = home.x-spring.width/2;
    var d = spring.D/spring.part;
    var sp_x = [], sp_y = [], w = [];
    var ori = home.y, 
    minD = spring.part*spring.height/2;

    var platform = {
      x: [], 
      y: [],
      Trmd:[],
      l: 0.2*wjs.canvas.width,//lenght
      t: 20,//thickness
      theta: 0,
      colorRGB: [217, 180, 74],
      fadeColorRGB: trial.home_color.map(x => Math.round(x * 0.5)),
      colorNowRGB: null
    };
    platform.x = [home.x-0.5*platform.l,home.x+0.5*platform.l,
      home.x+0.5*platform.l,home.x-0.5*platform.l];
    platform.y = [home.y,home.y,home.y-platform.t,home.y-platform.t];
    
    
    // randomlize object position
    // trial.obj_choice
    var obj_pos  = trial.random ? jsPsych.randomization.repeat([0,1,2,3], 1):[0,1,2,3];

    var ro = { // objects
      x: [],
      y: [],
      Trmd:[],
      sizex: [],
      sizey: [68,93,93,68],
      group: [0,1,0,1],
      location:[],
      lox:[],
      loy:[],
      colorRGB: [54, 255, 141,0.8],
      distance: wjs.canvas.height*0.2
    };
    ro.sizex = ro.sizey.map(x => x*0.6);
    // ro.sizex = [60,60,60,60];
    ro.lox[obj_pos[0]] = home.x-ro.distance*Math.sqrt(3)/2;
    ro.loy[obj_pos[0]] = platform.y[2]-ro.distance*0.5;

    ro.lox[obj_pos[1]] = home.x-ro.distance*Math.sin(20/180*Math.PI);
    ro.loy[obj_pos[1]] = platform.y[2]-ro.distance*Math.cos(20/180*Math.PI);

    ro.lox[obj_pos[2]] = home.x+ro.distance*Math.sin(20/180*Math.PI);
    ro.loy[obj_pos[2]] = platform.y[2]-ro.distance*Math.cos(20/180*Math.PI);

    ro.lox[obj_pos[3]] = home.x+ro.distance*Math.sqrt(3)/2;
    ro.loy[obj_pos[3]] = platform.y[2]-ro.distance*0.5;

    for(var i = 0; i<ro.lox.length; i++){
      ro.x[i] = [ro.lox[i]-ro.sizex[i]/2,ro.lox[i]+ro.sizex[i]/2,ro.lox[i]+ro.sizex[i]/2,ro.lox[i]-ro.sizex[i]/2];
      ro.y[i] = [ro.loy[i],ro.loy[i],ro.loy[i]-ro.sizey[i],ro.loy[i]-ro.sizey[i]];
    }


    // not change
    var g = 9.81, 
    k = 100, 
    c = 3, 
    gravityList = [4,4,10,10],
    maxMeter = 0.15, 
    maxPixel = spring.D-minD;
    failFlag = false,
    feedbackFlag = false,
    result_text = '', 
    failColor = [255, 61, 61], 
    sucColor = [3, 252, 103],
    resultColor = [200,200,200];
    areaColor = [200,200,200];
    var bonusNum = 0;
    var error_dur = 5; //(sec)
    var map_cursor_y = 0.75; // <1 slow down cursor.y

    // images
    var wt4 = new Image,
    wt1 = new Image,
    spb = new Image, 
    spf = new Image,
    left = new Image, 
    right = new Image, 
    rod = new Image,
    support = new Image, 
    push = new Image, 
    polar = new Image, 
    base = new Image,
    clampRT = new Image, 
    clampRB = new Image;
  
    wt4.src = 'images/wt5.png';
    wt1.src = 'images/wt6.png';
    spb.src = 'images/sp_blarge_matt.png';
    spf.src = 'images/sp_flarge.png';
    // spb.src = 'images/springback.png';
    // spf.src = 'images/springfront.png';
    left.src = 'images/left.png';
    rod.src = 'images/rod.png'
    right.src = 'images/right.png';
    support.src = 'images/platform.png';
    push.src = 'images/push.png';
    polar.src = 'images/polar.png';
    base.src = 'images/base.png';
    clampRT.src = 'images/clamp_r_head.png';
    clampRB.src = 'images/clamp_r_bottom.png';
  
    var clampLength = wjs.canvas.height*0.1;
    var pusht = 14;
    var pushy = [ori + spring.D+spring.height/2+pusht,ori + spring.D+spring.height/2+pusht,
      ori + spring.D+spring.height/2,ori + spring.D+spring.height/2];
    pushx = [home.x-spring.width*0.6,
      home.x+spring.width*0.6,home.x+spring.width*0.6,
      home.x-spring.width*0.6],
    basex = [home.x-spring.width*0.8,
      home.x+spring.width*0.8,home.x+spring.width*0.8,
      home.x-spring.width*0.8],
    basey = [ori + spring.D+spring.height/2+pusht+10,ori + spring.D+spring.height/2+pusht+10,
        ori + spring.D+spring.height/2+pusht,ori + spring.D+spring.height/2+pusht];
    // spf.src = 'images/springfront2.png';
    // spb.src = 'images/springback2.png';


    // change trial-by-trial
    var ch = trial.obj_choice;
    var obj_gra = gravityList[ch], 
    finalPos = [],
    finalForce = [];
    var  PT = trial.pre_time;

    if (trial.demo_trial){
      ch = 2;
      obj_gra = gravityList[2];
      // PT = 2;
      ro.lox[ch] = home.x;
      ro.loy[ch] = platform.y[2]-ro.distance;
      ro.x[ch] = [ro.lox[ch]-ro.sizex[ch]/2,ro.lox[ch]+ro.sizex[ch]/2,ro.lox[ch]+ro.sizex[ch]/2,ro.lox[ch]-ro.sizex[ch]/2];
      ro.y[ch] = [ro.loy[ch],ro.loy[ch],ro.loy[ch]-ro.sizey[ch],ro.loy[ch]-ro.sizey[ch]];
    }
    var error_line = obj_gra/k*0.2/maxMeter*maxPixel;
    var answer = home.y+spring.D-obj_gra/k/maxMeter*maxPixel;
    var disx = home.x-ro.lox[ch],
    disy = platform.y[2]-ro.loy[ch],
    ax = disx*2/PT/PT,
    ay = disy*2/PT/PT,
    v0x = PT*ax,
    v0y = PT*ay;


    // change with time
    var pos = 0, 
    vel = 0, 
    acc = 0,
    displace = [],
    x_ex = [], 
    F_ex = [],
    LastTime = [],
    deltaT = [],
    displayY = [];

    var cursor = {
      x: Number.isNaN(wjs.cursor.x) ? home.x : wjs.cursor.x,
      y: Number.isNaN(wjs.cursor.x) ? home.y : wjs.cursor.y,
      velocity: { x:0,y:0 },
      display: { x:0,y:0 },
      speed: 0,
      radius: trial.cursor_radius,
      colorRGB: [255,255,255],
      colorOutRGB: [192, 0, 0],
      fadeColorRGB: trial.cursor_color.map(x => Math.round(x * 0.5 )),
      speed_thresh: 6, // speed threshold for atTarget and atHome
      atHome: 0
    };

    // reaction time
    var reactionTime = -1;
    var startFlag = false;
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
      // cursor.distanceToHome = wjs_distance(cursor.display,home);
      cursor.atHome = cursorAtHome();
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

          if (trial.demo_trial || trial.pra_trial){
            wjs.trial_feedback_text = 'The blue plate is control by your mouse. \n Move it to the start position.';
          }else{
            wjs.trial_feedback_text = 'Move to the start position.';
          }
          if (cursor.atHome){ // If the cursor is at home
            wjs.trial_feedback_text = '';
            State.Next(State.WAIT); // advance
          }
          break;

      case State.WAIT:
        wjs.trial_feedback_text = 'Stay at the start position \n before press SPACE...';
        if (cursor.atHome){
           window.addEventListener("keyup",nextTrial,true );
           State.Next(State.GO);
         }
         break;

      case State.GO:
        if (trial.demo_trial){
          wjs.trial_feedback_text = 'Press SPACE to start a trial.\n Then, push up the plate \n to appropriate place ASAP.';
        }else if(trial.pra_trial){
          wjs.trial_feedback_text = 'Press SPACE to start a trial.\n Randomly, one of the 4 objects\n will move down.';
        }else{
          wjs.trial_feedback_text = 'Press SPACE to start a trial.';
        }
        if (!cursor.atHome){
          window.removeEventListener("keyup",nextTrial,true );
          State.Next(State.WAIT);
        }
        break;
  
      case State.MOVING:
        if (trial.demo_trial || trial.pra_trial){
          wjs.trial_feedback_text = 'Push the spring before the object arrive!';
        }else{
          wjs.trial_feedback_text = '';
        }

        if(cursor.y <= ori+spring.D-20*map_cursor_y && !startFlag){
          reactionTime = State.ElapsedSec();
          startFlag = true;
        }       
        if(State.ExpiredSec(1) && !startFlag){
          wjs.trial_feedback_text = '';

            State.Next(State.ERROR);
          
        }else if (!State.ExpiredSec(PT)){
          ro.location[0] = v0x*State.ElapsedSec()-ax/2*Math.pow(State.ElapsedSec(),2)+ro.lox[ch];
          ro.location[1] = v0y*State.ElapsedSec()-ay/2*Math.pow(State.ElapsedSec(),2)+ro.loy[ch];
          // ro.location[0] = [home.x-ro.lox[ch]]/PT*State.ElapsedSec()+ro.lox[ch];
          // ro.location[1] = [platform.y[2]-ro.loy[ch]]/PT*State.ElapsedSec()+ro.loy[ch];
          ro.x[ch] = [ro.location[0]-ro.sizex[ch]/2,ro.location[0]+ro.sizex[ch]/2,ro.location[0]+ro.sizex[ch]/2,ro.location[0]-ro.sizex[ch]/2];
          ro.y[ch] = [ro.location[1],ro.location[1],ro.location[1]-ro.sizey[ch],ro.location[1]-ro.sizey[ch]];
        }else{
          ro.location[0] = home.x;
          ro.location[1] = platform.y[2];
          ro.x[ch] = [ro.location[0]-ro.sizex[ch]/2,ro.location[0]+ro.sizex[ch]/2,ro.location[0]+ro.sizex[ch]/2,ro.location[0]-ro.sizex[ch]/2];
          ro.y[ch] = [ro.location[1],ro.location[1],ro.location[1]-ro.sizey[ch],ro.location[1]-ro.sizey[ch]];
          
          if(cursor.y >= ori+minD && cursor.y <= ori+spring.D){
            x_ex = (ori+spring.D-cursor.y)/maxPixel*maxMeter;
            finalPos = cursor.y;
            d = (cursor.y-ori)/spring.part;
            pushy = [cursor.y+spring.height/2+pusht,cursor.y+spring.height/2+pusht,
              cursor.y+spring.height/2,cursor.y+spring.height/2];
          }else if(cursor.y < ori+minD){
            x_ex = (spring.D-minD)/maxPixel*maxMeter;
            finalPos = ori+minD;
            d = minD/spring.part;
            pushy = [ori+minD+spring.height/2+pusht,ori+minD+spring.height/2+pusht,
              ori+minD+spring.height/2,ori+minD+spring.height/2];
          }else if(cursor.y > ori+spring.D){
            x_ex = 0;
            finalPos = ori+spring.D;
            d = spring.D/spring.part;
            pushy = [ori + spring.D+spring.height/2+pusht,ori + spring.D+spring.height/2+pusht,
              ori + spring.D+spring.height/2,ori + spring.D+spring.height/2];
          }
          // console.log([Math.round(pushy[0]),Math.round(ori + d*spring.part)+19,
          // finalPos+19,cursor.y+19],'x1');
          F_ex = x_ex*k;
          finalForce = F_ex;
          LastTime = wjs_get_secs();
          wjs.trial_feedback_text = '';
          State.Next(State.FEEDBACK);
        }
        // window.addEventListener("keyup",startFeedback,true );
        break;
  
      case State.FEEDBACK:
        if(State.ElapsedSec() >= 1 && !feedbackFlag ){  
          feedbackFlag = true;
          if (finalPos>home.y+spring.D-obj_gra/k/maxMeter*maxPixel*0.8){
            //under 
            failFlag = true;
            resultColor = failColor;
            areaColor = failColor;
            result_text = 'Fail.\n ';
            if (trial.demo_trial || trial.pra_trial){
              wjs.trial_feedback_text = 'You underestimated the weigth. \n The platform fall below the success zone.';
            }
          } else if(finalPos<home.y+spring.D-obj_gra/k/maxMeter*maxPixel*1.2){
            //over    
            failFlag = true;
            resultColor = failColor;
            areaColor = failColor;
            result_text = 'Fail.\n ';
            if (trial.demo_trial || trial.pra_trial){
              wjs.trial_feedback_text = 'You overstimated the weigth. \n The platform pop up the success zone.';
            }
          } else {
            resultColor = sucColor;
            areaColor = sucColor;
            result_text = 'Succeed!'
            if (trial.demo_trial || trial.pra_trial){
              wjs.trial_feedback_text = 'Good job. \n The platform is hold in place!';
            }else{
              wjs.totalbonus++;
            }
          }
        }
          acc = (F_ex-obj_gra-k*pos-c*vel)/(obj_gra/g);
          deltaT = wjs_get_secs()-LastTime;
          LastTime = wjs_get_secs();
          vel = vel+acc*deltaT;
          pos = pos+vel*deltaT;
          displace = -pos/maxMeter*maxPixel;
          platform.y = [home.y+displace,home.y+displace,
            home.y+displace-platform.t,home.y+displace-platform.t];
          ori = platform.y[0];
          d = (finalPos-ori)/spring.part;
          ro.location[0] = home.x;
          ro.location[1] = platform.y[2];
          ro.x[ch] = [ro.location[0]-ro.sizex[ch]/2,ro.location[0]+ro.sizex[ch]/2,ro.location[0]+ro.sizex[ch]/2,ro.location[0]-ro.sizex[ch]/2];
          ro.y[ch] = [ro.location[1],ro.location[1],ro.location[1]-ro.sizey[ch],ro.location[1]-ro.sizey[ch]];
        
        if(trial.demo_trial || failFlag){
          if(State.ExpiredMSec(trial.feedback_dur)){
            if(trial.demo_trial || trial.pra_trial){
              pos = (F_ex-obj_gra)/k;
              displace = -pos/maxMeter*maxPixel;
              platform.y = [home.y+displace,home.y+displace,
                home.y+displace-platform.t,home.y+displace-platform.t];
              ori = platform.y[0];
              d = (finalPos-ori)/spring.part;
              ro.location[0] = home.x;
              ro.location[1] = platform.y[2];
              ro.x[ch] = [ro.location[0]-ro.sizex[ch]/2,ro.location[0]+ro.sizex[ch]/2,ro.location[0]+ro.sizex[ch]/2,ro.location[0]-ro.sizex[ch]/2];
              ro.y[ch] = [ro.location[1],ro.location[1],ro.location[1]-ro.sizey[ch],ro.location[1]-ro.sizey[ch]];
              vel = 0;
              acc = 0;
              LastTime = wjs_get_secs();
              window.addEventListener("keyup",gotoFinish,true );
            }
            State.Next(State.RESULT);
          }
        }else{
          if(State.ExpiredMSec(trial.feedback_dur-1500)){
            if(trial.demo_trial || trial.pra_trial){
              pos = (F_ex-obj_gra)/k;
              displace = -pos/maxMeter*maxPixel;
              platform.y = [home.y+displace,home.y+displace,
                home.y+displace-platform.t,home.y+displace-platform.t];
              ori = platform.y[0];
              d = (finalPos-ori)/spring.part;
              ro.location[0] = home.x;
              ro.location[1] = platform.y[2];
              ro.x[ch] = [ro.location[0]-ro.sizex[ch]/2,ro.location[0]+ro.sizex[ch]/2,ro.location[0]+ro.sizex[ch]/2,ro.location[0]-ro.sizex[ch]/2];
              ro.y[ch] = [ro.location[1],ro.location[1],ro.location[1]-ro.sizey[ch],ro.location[1]-ro.sizey[ch]];
              vel = 0;
              acc = 0;
              LastTime = wjs_get_secs();
              window.addEventListener("keyup",gotoFinish,true );
            }
            State.Next(State.RESULT);
          }
        }
        break;

      case State.RESULT:
        if (trial.demo_trial || trial.pra_trial){
          if(cursor.y >= home.y+minD && cursor.y <= home.y+spring.D){
            displayY = cursor.y;
          }else if(cursor.y < home.y+minD){
            displayY = home.y+minD;
          }else if(cursor.y > home.y+spring.D){
            displayY = home.y+spring.D;
          }
          x_ex = (ori+spring.D-displayY)/maxPixel*maxMeter;
          F_ex = x_ex*k;
          acc = (F_ex-obj_gra-c*vel)/(obj_gra/g);
          deltaT = wjs_get_secs()-LastTime;
          LastTime = wjs_get_secs();
          vel = vel+acc*deltaT;
          pos = pos+vel*deltaT;
          displace = -pos/maxMeter*maxPixel;
          platform.y = [home.y+displace,home.y+displace,
          home.y+displace-platform.t,home.y+displace-platform.t];
          ori = platform.y[0];
          if (ori>home.y+error_line||ori<home.y-error_line){
            areaColor = failColor;
          }else{
            areaColor = sucColor;
          }
          d = (displayY-ori)/spring.part;
          pushy = [displayY+spring.height/2+pusht,displayY+spring.height/2+pusht,
          displayY+spring.height/2,displayY+spring.height/2];
          ro.location[0] = home.x;
          ro.location[1] = platform.y[2];
          ro.x[ch] = [ro.location[0]-ro.sizex[ch]/2,ro.location[0]+ro.sizex[ch]/2,ro.location[0]+ro.sizex[ch]/2,ro.location[0]-ro.sizex[ch]/2];
          ro.y[ch] = [ro.location[1],ro.location[1],ro.location[1]-ro.sizey[ch],ro.location[1]-ro.sizey[ch]];

        }else if (State.ExpiredSec(1)){
          State.Next(State.FINISH);
        }
        break;

      case State.ERROR:
        result_text = 'You reponsed too slow.\n Push up the spring after press SPACE.';
        resultColor = failColor;
        areaColor = failColor;
        if (State.ExpiredSec(error_dur)){
          if(trial.demo_trial || trial.pra_trial || trial.repeat){
            startFlag = false;
            result_text = '';
            wjs.trial_feedback_text = '';
            ro.location = [];
            resultColor = [200,200,200];
            areaColor = [200,200,200];
            ro.x[ch] = [ro.lox[ch]-ro.sizex[ch]/2,ro.lox[ch]+ro.sizex[ch]/2,ro.lox[ch]+ro.sizex[ch]/2,ro.lox[ch]-ro.sizex[ch]/2];
            ro.y[ch] = [ro.loy[ch],ro.loy[ch],ro.loy[ch]-ro.sizey[ch],ro.loy[ch]-ro.sizey[ch]];
            State.Next(State.START);
          }else{
            failFlag = true;
            data.missTrial = 1;
            data.missTrialMsg = 'rt';
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
          // State.Pop();
          State.Next(State.FINISH);
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
          if (State.Stack >= State.GO && State.Stack <= State.ERROR){
            State.Next(State.FINISH);
          }else{
            State.Pop(); // Return to previous state when POINTER_LOCK triggered.
          }

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
      if( (State.Current === State.POINTER_LOCK) )
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

      // set pusher location
      if(State.Current>=State.START && State.Current<State.GO){
        if(cursor.y >= home.y-pusht/2){
          pushy = [cursor.y+spring.height/2+pusht,cursor.y+spring.height/2+pusht,
            cursor.y+spring.height/2,cursor.y+spring.height/2];
        }else{
          pushy = [home.y+spring.height/2+pusht/2,home.y+spring.height/2+pusht/2,
            home.y+spring.height/2-pusht/2,home.y+spring.height/2-pusht/2];
        }
      }
      // if ((Math.round(pushy[0])-Math.round(ori + d*spring.part)-19 > 2) || (Math.round(pushy[0])-Math.round(ori + d*spring.part)-19 < -2)){
      //   console.log([Math.round(pushy[0]),Math.round(ori + d*spring.part)+19,
      // finalPos+19,cursor.y+19]);
        
      // }

      if(State.Current>=State.GO && State.Current<=State.MOVING){
        if(cursor.y >= ori+minD && cursor.y <= ori+spring.D){
          d = (cursor.y-ori)/spring.part;
          pushy = [cursor.y+spring.height/2+pusht,cursor.y+spring.height/2+pusht,
            cursor.y+spring.height/2,cursor.y+spring.height/2];
        }else if(cursor.y < ori+minD){
          d = minD/spring.part;
          pushy = [ori+minD+spring.height/2+pusht,ori+minD+spring.height/2+pusht,
            ori+minD+spring.height/2,ori+minD+spring.height/2];
        }else if(cursor.y > ori+spring.D){
          d = spring.D/spring.part;
          pushy = [ori + spring.D+spring.height/2+pusht,ori + spring.D+spring.height/2+pusht,
            ori + spring.D+spring.height/2,ori + spring.D+spring.height/2];
        }
      }

      if(State.Current<=State.RESULT){
        if (State.Current>=State.GO){
          // draw spring
          spring.angle = Math.atan(d/spring.width);
          spring.cy = ori ;
          w = spring.width;
          sp_x = [spring.cx,spring.cx+w,spring.cx+w,spring.cx];
          sp_y = [spring.cy+spring.height/2,spring.cy+spring.height/2,spring.cy-spring.height/2,spring.cy-spring.height/2];
          wjs_draw_image(spf,sp_x,sp_y,spring.cx,spring.cy,0);
          w = Math.sqrt(spring.width*spring.width+d*d);
          sp_x = [spring.cx,spring.cx+w,spring.cx+w,spring.cx];
          for(var i = 0; i<spring.part/2; i++){
            spring.cy = ori + 2*d*i +d;
            sp_y = [spring.cy+spring.height/2,spring.cy+spring.height/2,spring.cy-spring.height/2,spring.cy-spring.height/2];
            wjs_draw_image(spb,sp_x,sp_y,spring.cx,spring.cy,spring.angle);
          }
          for(var i = 0; i<spring.part/2; i++){
            spring.cy = ori + 2*d*i +d;
            sp_y = [spring.cy+spring.height/2,spring.cy+spring.height/2,spring.cy-spring.height/2,spring.cy-spring.height/2];
            wjs_draw_image(spf,sp_x,sp_y,spring.cx,spring.cy,-spring.angle);
          }
          w = spring.width;
          sp_x = [spring.cx,spring.cx+w,spring.cx+w,spring.cx];
          spring.cy = ori + d*spring.part;
          sp_y = [spring.cy+spring.height/2,spring.cy+spring.height/2,spring.cy-spring.height/2,spring.cy-spring.height/2];
          wjs_draw_image(spf,sp_x,sp_y,spring.cx,spring.cy,0);
         }

        // draw platform
        wjs_draw_image(support,platform.x,platform.y,platform.x[0],platform.x[0],0);

        // draw base and polar
        if (State.Current>=State.GO){
          wjs.canvas_context.drawImage(polar,0,0,120,(basey[0]-pushy[0])*120/32,home.x-16,pushy[0],32,basey[2]-pushy[0])
          wjs_draw_image(base,basex,basey,0,0,0);
        }
        //draw pusher
        wjs_draw_image(push,pushx,pushy,0,0,0);
      }
       
      // draw correct mouse position
      if (trial.demo_trial && feedbackFlag ){
    
        wjs_draw_shape([home.x-50, home.x+50, home.x+50, home.x-50],
          [home.y+spring.D-obj_gra/k/maxMeter*maxPixel+pusht/2+spring.height/2-error_line+pusht/2,
           home.y+spring.D-obj_gra/k/maxMeter*maxPixel+pusht/2+spring.height/2-error_line+pusht/2,
           home.y+spring.D-obj_gra/k/maxMeter*maxPixel+pusht/2+spring.height/2+error_line-pusht/2,
           home.y+spring.D-obj_gra/k/maxMeter*maxPixel+pusht/2+spring.height/2+error_line-pusht/2],
           areaColor.concat(0.2));


        //  wjs_draw_shape([platform.x[0]-10,platform.x[1]+10,platform.x[2]+10,platform.x[3]-10], 
        //   [home.y-error_line-platform.t+2 ,home.y-error_line-platform.t+2,home.y+error_line-2 ,home.y+error_line-2], 
        //   areaColor.concat(0.2));
        wjs_draw_text([home.x+210,home.y+spring.D-obj_gra/k/maxMeter*maxPixel+pusht/2+spring.height/2+6],
          'Plate should be setted here.',18,areaColor);

      }

      // draw the start position and text
      if (State.Current<State.GO){
        if (!cursor.atHome){
          wjs_draw_shape(pushx,[ori + spring.D+spring.height/2+pusht,ori + spring.D+spring.height/2+pusht,
            ori + spring.D+spring.height/2,ori + spring.D+spring.height/2], [6,182,246,0.3]) 
          wjs_draw_text([home.x+100,ori+spring.D],'Start\nPosition',18,[6,182,246]);
        }
      }

      // draw the weights and the clamps on the weights
      if (State.Current==State.GO){
        if(trial.demo_trial){
          if(ro.group[ch]){
            wjs_draw_image(wt4,ro.x[ch],ro.y[ch].map(x => x+4),home.x,home.y,0);
          }else{
            wjs_draw_image(wt1,ro.x[ch],ro.y[ch].map(x => x+4),home.x,home.y,0);
          }
          wjs.canvas_context.drawImage(rod, 0,0, ro.sizex[ch]*66/20,66, 
                      ro.x[ch][3],ro.y[ch][3]-clampLength-4+ro.sizey[ch]/3*2,  ro.sizex[ch], 20);
          wjs.canvas_context.drawImage(left, ro.x[ch][3]-20, ro.y[ch][3]-clampLength+ro.sizey[ch]/3*2, 20, clampLength);
          wjs.canvas_context.drawImage(right, ro.x[ch][2], ro.y[ch][3]-clampLength+ro.sizey[ch]/3*2, 20, clampLength);
        }else{
          for (var j=0; j<ro.lox.length; j++){
            if(ro.group[j]){
              wjs_draw_image(wt4,ro.x[j],ro.y[j].map(x => x+4),home.x,home.y,0);
            }else{
              wjs_draw_image(wt1,ro.x[j],ro.y[j].map(x => x+4),home.x,home.y,0);
            }           
            wjs.canvas_context.drawImage(rod, 0,0, ro.sizex[j]*66/20,66, 
                        ro.x[j][3],ro.y[j][3]-clampLength-4+ro.sizey[j]/3*2,  ro.sizex[j], 20);
            wjs.canvas_context.drawImage(left, ro.x[j][3]-20, ro.y[j][3]-clampLength+ro.sizey[j]/3*2, 20, clampLength);
            wjs.canvas_context.drawImage(right, ro.x[j][2], ro.y[j][3]-clampLength+ro.sizey[j]/3*2, 20, clampLength);
          }
        }
      }

      // draw the selected weight and the clamp on the weight
      if(State.Current == State.MOVING){
        if (!trial.demo_trial){
          for (var j=0; j<ro.lox.length; j++){
            if(j!=ch){
              if(ro.group[j]){
                wjs_draw_image(wt4,ro.x[j],ro.y[j].map(x => x+4),home.x,home.y,0);
              }else{
                wjs_draw_image(wt1,ro.x[j],ro.y[j].map(x => x+4),home.x,home.y,0);
              }           
              wjs.canvas_context.drawImage(rod, 0,0, ro.sizex[j]*66/20,66, 
                          ro.x[j][3],ro.y[j][3]-clampLength-4+ro.sizey[j]/3*2,  ro.sizex[j], 20);
              wjs.canvas_context.drawImage(left, ro.x[j][3]-20, ro.y[j][3]-clampLength+ro.sizey[j]/3*2, 20, clampLength);
              wjs.canvas_context.drawImage(right, ro.x[j][2], ro.y[j][3]-clampLength+ro.sizey[j]/3*2, 20, clampLength);
            }
          }
        }
        wjs.canvas_context.drawImage(rod, 0,0, ro.sizex[ch]*66/20,66, 
          ro.x[ch][3],ro.y[ch][3]-clampLength-4+ro.sizey[ch]/3*2,  ro.sizex[ch], 20);
        wjs.canvas_context.drawImage(left, ro.x[ch][3]-20, ro.y[ch][3]-clampLength+ro.sizey[ch]/3*2, 20, clampLength);
        wjs.canvas_context.drawImage(right, ro.x[ch][2], ro.y[ch][3]-clampLength+ro.sizey[ch]/3*2, 20, clampLength);
      }

      if (State.Current>=State.MOVING && State.Current <= State.RESULT){
        if(ro.group[ch]){
          wjs_draw_image(wt4,ro.x[ch],ro.y[ch].map(x => x+4),home.x,home.y,0);
        }else{
          wjs_draw_image(wt1,ro.x[ch],ro.y[ch].map(x => x+4),home.x,home.y,0);
        }
      }

      // draw the clamp on the platform
      if (State.Current < State.FEEDBACK){ 
        wjs.canvas_context.drawImage(clampRB, platform.x[1]-18-10, platform.y[1], 36,43);
        wjs.canvas_context.drawImage(clampRT, platform.x[2]-8-10, platform.y[2]-15, 36,60);
      }

      // All the feedbacks
      if (State.Current == State.FEEDBACK || State.Current == State.RESULT){
        wjs_draw_shape([platform.x[0]-10,platform.x[1]+10,platform.x[2]+10,platform.x[3]-10], 
          [home.y-error_line-platform.t+2 ,home.y-error_line-platform.t+2,home.y+error_line-2 ,home.y+error_line-2], 
          areaColor.concat(0.2));
        wjs_draw_text([home.x,home.y],'Success Zone',18,[255,255,255,0.5]);
        wjs.canvas_context.drawImage(clampRB, platform.x[1]-18-10+40, home.y+5, 36,43);
        wjs.canvas_context.drawImage(clampRT, platform.x[2]-8-10+40, home.y-platform.t-15, 36,60);
        wjs_draw_text([home.x,200],result_text,38,resultColor);
      }
      if(State.Current == State.FEEDBACK && !State.ExpiredSec(0.2)){
        wjs.canvas_context.drawImage(rod, 0,0, ro.sizex[ch]*66/20,66, 
          ro.x[ch][3],home.y-clampLength-4-ro.sizey[ch]/2-State.ElapsedMSec()*0.5,  ro.sizex[ch], 20);
        wjs.canvas_context.drawImage(left, ro.x[ch][3]-20, home.y-clampLength-ro.sizey[ch]/2-State.ElapsedMSec()*0.5, 20, clampLength);
        wjs.canvas_context.drawImage(right, ro.x[ch][2], home.y-clampLength-ro.sizey[ch]/2-State.ElapsedMSec()*0.5, 20, clampLength);
      }

      if (State.Current == State.RESULT && (trial.demo_trial || trial.pra_trial)){
        // if(failFlag){
          wjs_draw_text([wjs.canvas.width*0.2,home.y],
            'You can move the plate to see \n where you suppose hold up to.',
          wjs.trial_feedback_size,[255,255,255]);
        // }
        wjs_draw_text([wjs.canvas.width*0.2,home.y+150],'Press ANY KEY to continue.',wjs.trial_feedback_size,[255,255,255]);
      }
      // react too late
      if (State.Current == State.ERROR){
        wjs_draw_text([centerXY.x,200],result_text,38,resultColor);
        var t = State.ElapsedSec();
        if (t < error_dur){
            wjs_draw_pie([home.x,home.y+100],130,0,(error_dur-t)/error_dur*360,[255,255,255,0.5]);
            wjs_draw_circle([home.x,home.y+100],90,trial.background_color,true,2);
        }
      }

      if(!trial.demo_trial && !trial.pra_trial){
        bonusNum = wjs.totalbonus/100;
        wjs_draw_text([100,50],'Bonus: \u0024'+bonusNum.toFixed(2),wjs.trial_feedback_size,sucColor);
      }

      // Draw feedback text
      // if(!trial.demo_trial){
        wjs_draw_text([wjs.canvas.width*0.2,home.y-100],wjs.trial_feedback_text,wjs.trial_feedback_size,wjs.trial_feedback_color);
      // }else{
        // Draw instruction text in demo trial (don't show feedback text during demo)
        // wjs_draw_text([centerXY.x,50],instructionText,wjs.trial_feedback_size,wjs.trial_feedback_color);
      // };

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
      if (e.code === 'Space' && cursor.atHome) {
        State.Next(State.MOVING);
        window.removeEventListener("keyup",nextTrial,true );
      }else if(!cursor.atHome){
        window.removeEventListener("keyup",nextTrial,true );
        State.Next(State.WAIT);
      }
    }

    function gotoFinish(e){
        State.Next(State.FINISH);
        window.removeEventListener("keyup",gotoFinish,true );
    }
    // Check if cursor is inside the path
    function cursorAtHome(){
      // console.log(cursor.x<lever.x[0]+20 && cursor.x>lever.x[0]-20 );
      return ((cursor.y<ori+spring.D+30*map_cursor_y) && (cursor.y>ori+spring.D) && (cursor.speed < cursor.speed_thresh));

      // && cursor.vel<cursor.speed_thresh
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
    
    function transformation(x,y,cx,cy,theta){
      // clockwise rotate theta around [cx,cy]
      let Cos = Math.cos(theta),
          Sin = Math.sin(theta),
          x_tr = x,
          y_tr = y,
          x_ro =new Array(x_tr.length).fill(NaN),
          y_ro =new Array(y_tr.length).fill(NaN);;
        for( var i=0; (i < x_tr.length); i++ ){
          x_ro[i] = Cos*(x_tr[i]-cx)-Sin*(y_tr[i]-cy)+cx;
          y_ro[i] = Sin*(x_tr[i]-cx)+Cos*(y_tr[i]-cy)+cy;
        };
        return [x_ro,y_ro];
    }

    function eventCursorUpdate(event) 
    { // Update local cursor object with global WJS cursor values.
      wjs_xy2xy(cursor,wjs.cursor);                   // cursor = wjs.cursor
      wjs_xy2xy(cursor.velocity,wjs.cursor.velocity); // cursor.velocity = wjs.cursor.velocity
      wjs_xy2xy(cursor.display,cursor);               // cursor.display = cursor

      cursor.y = (cursor.y-home.y-spring.D)*map_cursor_y+(home.y+spring.D);

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
        "correctPos": answer,
        "finalPos":finalPos,
        "finalForce":finalForce,
        "PT":PT,
        "obj_gra":obj_gra,
        "sizex": ro.sizex[ch],
        "sizey": ro.sizey[ch],
        "choice": ch,
        "obj_pos": obj_pos,
        "reactionTime": reactionTime,
        //"cursorSpeed": data.velArray, // Cursor velocity
        "TrialTime": data.timeArray, // Array of time stamps for each trajectory data point (time point since trial start)
        //"RawTime": data.rawTimeArray,// Raw time stamp
        "State": data.stateArray, // Array of states since go cue
        "nDisplayRefresh": wjs_frame_count, //data.frameRate.length, // Number of frames in this trial    
        //"avgFrameInt": diff(data.timeArray).reduce((total,current) => total + current)/frameID, // Average frame rate of trial  
        "missTrial": data.missTrial, // miss trial (true/false)
        "missTrialMsg": data.missTrialMsg, // miss trial message/type
        "homePos": [home.x, home.y],//trial.home_location,
        "fullScreenExitTime": data.fullScreenExitTime, // time of full-screen exit (if any)
        "winResizeTime": data.resizeTime, // time of window resize
        "canvCenter": [centerXY.x, centerXY.y],
        "bonus": wjs.totalbonus,
        "map_cursor_y":map_cursor_y
      };

      jsPsych.finishTrial(trial_data); // this function automatically writes all the trial_data
    }; //End of end_trial() function
  }; // End of the plugin's trial() method
  
  return plugin;
})();
