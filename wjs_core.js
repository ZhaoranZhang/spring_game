/******************************************************************************/
/*                                                                            */
/* NAME    : WJS_core.js                                                      */
/*                                                                            */
/* PURPOSE : Wolpert-lab JavaScript core library.                             */
/*                                                                            */
/* DATE    : 27/Apr/2020                                                      */
/*                                                                            */
/* CHANGES                                                                    */
/*                                                                            */
/* V0.0  JNI 27/Apr/2020 - Initial development of module (with VMRSR).        */
/*                                                                            */
/* V0.1  JNI 27/May/2020 - Continue development with latest version of VMRSR. */
/*                                                                            */
/* V0.2  JNI 11/Jun/2020 - Present to the group for discussion and feedback.  */
/*                                                                            */
/******************************************************************************/

// Simple classes for xy and xyz vectors.
class wjs_xy  { x=NaN; y=NaN; };
class wjs_xyz { x=NaN; y=NaN; z=NaN; };

/******************************************************************************/

var wjs = { }; // The global wjs object is populated by various functions below.

wjs.mouse = new wjs_xy;

wjs.cursor = new wjs_xy;
wjs.cursor.velocity = new wjs_xy;
wjs.cursor.time_stamp = 0;

// Home position is used for pointer-lock.
wjs.home = new wjs_xy;
wjs.home.radius = 0;

// Trial feedback text (also feedback set and clear functions below).
wjs.trial_feedback_text = '';
wjs.trial_feedback_color = 'white';
wjs.trial_feedback_size = 20;

// The application can turn these flags on for testing, etc.
var wjs_debug_log_flag = false;         // Log debug messages to the console.
var wjs_local_save_flag = false;        // Save data locally without connecting to Firebase.
var wjs_trial_preview_flag = false;     // Save the trial-list locally, with running experiment.

// Trial timing gaps (after) and intervals (in-between).
var wjs_post_trial_gap = 0;             // ms 
var wjs_inter_trial_interval = 0;       // ms 

var wjs_trial_number = 0;               // Incrementing count of experimental trials run so far.
var wjs_trial_count = 0;                // Incrementing count of all trials run so far.
var wjs_trial_total = 0;                // Total number of all trials, must be set by application.

// Global variables for the experiment, MTurk and Firebase.
var wjs_experiment_name;
var wjs_worker_id;
var wjs_firebase_uid;
var wjs_firebase_signInMetadata;        // Ugh! Mixing snake case and camel case, why?
var wjs_confirmation_code;

/******************************************************************************/
// Some standard trial definitions for the jsPsych time-line.

// Consent form.
var wjs_trial_consent = 
{ 
    type: 'wjs-survey-multi-select',
    questions: [
    {
        prompt: '<p style="margin-top:1em; margin-bottom:1em">Please read the consent form and sign by ticking the checkbox.</p>'+
        '<iframe src="consent.pdf#zoom=75" width="90%" height="300px"></iframe>'+
        '<p style="font-size:10pt; margin:0">' +
        '<a href="consent.pdf" target="_blank" download="consent.pdf" style="font-size:10pt; margin:0; color:#b0ccff">' +
        'Click here to download the pdf for your records.</a></p>',
        options: ['I agree to take part in this study.'],
        required: true,
        name: 'agree'
        }
    ],
    data: function() 
    {
        // When you're using this data variable, use simple strings! I had trouble without...
        let data = { };
        data.Date = wjs_date_object();
        data.WorkerId = JSON.stringify(wjs_worker_id);
        return data;
    },
    on_load: function() { if( !wjs_local_save_flag ) { wjs_firebase_signin() }; },
    on_finish: function(trialdata) { jsPsych.setProgressBar(1/wjs_trial_total) }, 
};

// Subject demographic information survey.
var wjs_trial_survey = 
{
    type: 'wjs-survey-all-types',
    questions: [
        {
            prompt: 'Please provide the following demographic information.', 
            question_type: 'multichoice',
            options: [],
            required: false,
            name: 'NotAQuestion'
        },
        {
            prompt: 'How old are you (in years)?', 
            required: true, 
            question_type: 'num',
            value_limit:[18,120],
            name: 'Age'
        },
        {
            prompt: 'What is your gender?', 
            options: ['Female', 'Male', 'Prefer to specify', 'Prefer not to say'], 
            required: true, 
            question_type: 'multichoice',
            horizontal: true,
            name: 'Gender'
        },
        {
            prompt: 'Please specify your gender:', 
            columns: 20, 
            required: false,
            question_type: 'text',
            name: 'GenderSpecify'
        },
        {
            prompt: 'Are you using a mouse or a trackpad?', 
            options: ['Mouse', 'Trackpad'], 
            question_type: 'multichoice',
            required: true, 
            horizontal: true,
            name: 'Device'
        },
        {
            prompt: 'Which hand do you use to control the mouse/trackpad?', 
            options: ['Left', 'Right'], 
            question_type: 'multichoice',
            required: true, 
            horizontal: true,
            name: 'Hand'
        }
    ]
};

// Enter full screen mode (at start of experiment).
var wjs_trial_enter_fullscreen = 
{
    type: 'fullscreen',
    message: '<h3>This experiment must be run in full-screen.</h3><br>',
    fullscreen_mode: true,
    data: {
        OS: function() { return wjs_os_get() },
        Browser: function() { return wjs_browser_get() },
        WindowDim: function() {return [window.screen.availWidth, window.screen.availHeight]},
    },
    delay_after: 200 // Delay to make sure screen size is updated correctly
};

// Exit full screen trial (at end of experiment).
var wjs_trial_exit_fullscreen = 
{
    type: 'fullscreen',
    message: '',
    fullscreen_mode: false,
    data: {  },
    delay_after: 200 // Delay to make sure screen size is updated correctly
};
  
// The experiment is over.
var wjs_trial_save_screen = 
{
    timeline: [ {
        type: 'wjs-html-button-response',
        stimulus: '<h3>The experiment is over. Thank you!</h3><br>',
        choices: [ 'Get Completion Code' ]
    } ],
    on_start: function() {
        wjs_pointerlock_stop();
        $('body').css('cursor', 'auto');
    }, // show cursor
};
  
// Get completion code.
var wjs_trial_code_screen = 
{
    timeline: [ {
        type: 'wjs-html-button-response',
        stimulus: '<h3>Return to MTurk and enter the following code to submit this HIT.</h3>' +
                  '<input type="text" value="" id="confirmCode" font-size=14pt width=100px readonly><br><br>',
        choices: ['Copy code to clipboard'],
        response_ends_trial: true,
        clear_html_on_finish: false
    } ],
    on_load: function() {
        if (typeof(firebase)!=='undefined') {
            var ref = firebase.database().ref('workers/' + wjs_worker_id + '/' + wjs_experiment_name + '/' + wjs_firebase_uid)
            .set({uid: wjs_firebase_uid},
            function(error) {
                if (error) {
                console.log('ERROR: Failed to save user data to firebase.');
                }
            });
            wjs_confirmation_code = wjs_firebase_uid;
        } else {
            wjs_confirmation_code = 'error: database undefined';
        }
        $('#confirmCode').css('border','none');
        $('#confirmCode').css('color','white');
        $('#confirmCode').css('text-align','center');
        $('#confirmCode').css('background-color','gray');
        $('#confirmCode').css('font-family','Courier');
        $('#confirmCode').css('font-size','16pt');
        $('#confirmCode').attr('readonly',true);
        $('#confirmCode').width('400px');
        $('#confirmCode').height('40px');
        $('#confirmCode').val(wjs_confirmation_code);
    },
    on_finish: function(){
        var copyText = document.getElementById('confirmCode');
        copyText.select(); // select the text field
        copyText.setSelectionRange(0, 99999); // for mobile devices
        document.execCommand('copy'); // copy the selected text
        document.querySelector('button').setAttribute('disabled', true);
        alert('Completion code copied to clipboard.')
    },
    /*loop_function: function(data){ // Always loop
        return true; // Repeat
    }*/
};

/******************************************************************************/
// Timer class.
class wjs_timer 
{
    Name = '';          // String name for timer.
    Items = 1000;       // Maximum number of elements
    Mark = 0;           // Starting time for timer

    LoopCount = 0;
    LoopMark = 0;
    LoopData = [ ];

    TocCount = 0;
    TocMark = 0;
    TocData = [ ];

    constructor(Name,Items)
    {
        if( typeof(Name) !== 'undefined' )
        {
            this.Name = Name;

            if( typeof(Items) !== 'undefined' )
            {
                this.Items = Items;
            };
        };

        this.Reset();
    };

    Reset = function()
    {
        this.LoopCount = 0;
        this.LoopMark = 0;
        this.LoopData = [ ];
    
        this.TocCount = 0;
        this.TocMark = 0;
        this.TocData = [ ];
    
        this.Mark = wjs_get_secs();
    };

    ElapsedSec= function(ResetFlag) 
    {
        var t = wjs_get_secs() - this.Mark;

        if( ResetFlag )
        {
            this.Reset();
        };

        return(t);
    };

    ElapsedMSec = function(ResetFlag)
    {
        var t = this.ElapsedSec(ResetFlag)*1000.0;
        return(t);
    };

    ExpiredSec = function(t,ResetFlag) 
    {
        var flag = (this.ElapsedSec() >= t);

        if( flag && ResetFlag)
        {
            this.Reset();
        };

        return(flag);
    };

    ExpiredMSec = function(t,ResetFlag)
    {
        var flag = this.ExpiredSec(t/1000.0,ResetFlag);
        return(flag);
    };

    Loop = function()
    {
        if( this.LoopMark == 0 )
        {
            this.LoopMark = wjs_get_secs();
            return(0.0);
        }

        var t = wjs_get_secs();
        var dt = t - this.LoopMark;
        this.LoopMark = t;
        
        if( this.LoopCount < this.Items )
        {
            this.LoopData.push(dt);
            this.LoopCount++;
        }
        else
        {
            this.LoopData.shift();
            this.LoopData.push(dt);
        };

        return(t);
    };

    Tic = function()
    {
        this.TocMark = wjs_get_secs();
        return(this.TocMark);
    };

    Toc = function()
    {
        if( this.TocMark == 0 )
        {
            return(0.0);
        }

        var t = wjs_get_secs();
        var dt = t - this.TocMark;
        this.TocMark = t;

        if( this.TocCount < this.Items )
        {
            this.TocData.push(dt);
            this.TocCount++;
        }
        else
        {
            this.TocData.shift();
            this.TocData.push(dt);
        };

        return(t);
    };

    GetSummary = function()
    {
        var S = { };

        S.Name = this.Name;

        // Loop frequency data.
        var p = wjs_array_stats(this.LoopData);
        S.LoopCount = p.n;
        S.LoopPeriodMean = p.mean;
        S.LoopPeriodSD = p.sd;

        var f = [ ];
        for( var i=0; (i < this.LoopData.length); i++ )
        {
            f.push(1.0/this.LoopData[i]);
        };

        f = wjs_array_stats(f);
        S.LoopFrequencyMean = f.mean;
        S.LoopFrequencySD = f.sd;

        // Tic/Toc interval data.
        var p = wjs_array_stats(this.TocData);
        S.TocCount = p.n;
        S.TocPeriodMean = p.mean;
        S.TocPeriodSD = p.sd;

        return(S);
    };

    Results = function()
    {
        var S = this.GetSummary();

        if( S.LoopCount > 0 )
        {
            wjs_debug_log(`${this.Name} Loop Period=${wjs_round(S.LoopPeriodMean*1000.0,3)}±${wjs_round(S.LoopPeriodSD*1000.0,3)}ms Frequency=${wjs_round(S.LoopFrequencyMean,3)}±${wjs_round(S.LoopFrequencySD,3)}Hz (n=${S.LoopCount})`)
        };

        if( S.TocCount > 0 )
        {
            wjs_debug_log(`${this.Name} Toc Interval=${wjs_round(S.TocPeriodMean*1000.0,3)}±${wjs_round(S.TocPeriodSD*1000.0,3)}ms (n=${S.TocCount})`);
        };

        return(S);
    };
};

/******************************************************************************/
// Finite state machine class.
class wjs_state 
{
    Current = 0;
    Last = 0;
    Count = 0;
    Names = [ ];
    Timer = null;
    FrameUpdateFunc = null;
    Stack = [ ];

    constructor(StateList,FrameUpdateFunc)
    {
        this.Count = StateList.length;
        this.Names = StateList;

        // Associate each state name variable with its index.
        for( var StateIndex=0; (StateIndex < this.Count); StateIndex++ )
        {
            eval('this.' + StateNames[StateIndex] + ' = StateIndex;');
        };

        this.Timer = new wjs_timer('StateTimer');

        if( typeof(FrameUpdateFunc) != 'undefined' )
        {
            this.FrameUpdateFunc = FrameUpdateFunc;
        };
    };

    Next = function(State,StartFlag) 
    {
        if( (this.Current === State) && !StartFlag )
        {
            return;
        };

        if( StartFlag )
        {
            wjs_debug_log(`State: ${this.Names[State]}`);
        }
        else 
        {
            wjs_debug_log(`State: ${this.Names[this.Current]} > ${this.Names[State]} (${wjs_round(this.Timer.ElapsedMSec(),1)}ms)`);
        }

        this.Timer.Reset();             // Reset state time.
        this.Last = this.Current;       // Save last state.
        this.Current = State;           // Change current state.

        // Call optional frame-update function.
        if( this.FrameUpdateFunc != null )
        {
            this.FrameUpdateFunc();
        };
    };

    Start = function(FrameUpdateFunc)
    {
        // Set optional frame-update function.
        this.FrameUpdateFunc = (typeof(FrameUpdateFunc) != 'undefined') ? FrameUpdateFunc : null;

        this.Stack = [ ]; // Reset state stack.

        this.Next(0,true); // StartFlag=true;
    };

    Push = function(State)
    {
        if( this.Current === State )
        {
            return;
        };

        this.Stack.push(this.Current);
        this.Next(State);
    };

    Pop = function()
    {
        var State;

        if( this.Stack.length > 0 )
        {
            State = this.Stack.pop();
            this.Next(State);
        };
    };

    ElapsedSec = function()
    {
        return(this.Timer.ElapsedSec());
    };

    ElapsedMSec = function()
    {
        return(this.Timer.ElapsedMSec());
    };

    ExpiredSec = function(t)
    {
        return(this.Timer.ExpiredSec(t));
    };

    ExpiredMSec = function(t)
    {
        return(this.Timer.ExpiredMSec(t));
    };
};

/******************************************************************************/
// Trial main-loop functions and variables.

var wjs_main_loop_timer = new wjs_timer('wjs_main_loop_timer');
var wjs_main_loop_count = 0; // Main-loop iteration count.
var wjs_main_loop_RAFid; // Request Animation Frame ID.

var wjs_frame_timestamp_array = [ ];
var wjs_frame_timestamp_last = 0;
var wjs_frame_count = 0;

var wjs_calc_func;
var wjs_state_func;
var wjs_display_func;
var wjs_stop_func;

var wjs_calc_func_timer = new wjs_timer('wjs_calc_func_timer');
var wjs_state_func = new wjs_timer('wjs_state_func');
var wjs_display_func = new wjs_timer('wjs_display_func');

var wjs_func_list = [ ];
var wjs_func_count = 3;
var wjs_func_timer_list = [ wjs_calc_func_timer,wjs_state_func,wjs_display_func ];

// The main-loop function (this is iterated with each display frame).
function wjs_main_loop_func(FTS)
{
var ExitFlag=false;

    // Time stamp for display frame (not used for now)
    /*if( (FTS == null) || (wjs_frame_timestamp_last == 0) ) 
    {
        wjs_frame_timestamp_last = performance.now();
    } 
    else 
    {
        wjs_frame_timestamp_array.push(FTS-wjs_frame_timestamp_last);
        wjs_frame_timestamp_last = FTS;
    };*/

    wjs_main_loop_count++; // Main-loop iteration count.

    wjs_main_loop_timer.Loop();
    wjs_main_loop_timer.Tic();
    
    // Loop over the 3 possible main-loop functions, executing each (if defined).
    for( var i=0; ((i < wjs_func_count) && !ExitFlag); i++ )
    {
        if( wjs_isnull(wjs_func_list[i]) )
        {
            continue;
        };

        wjs_func_timer_list[i].Tic();
        ExitFlag = wjs_func_list[i]() || ExitFlag;
        wjs_func_timer_list[i].Toc();
    };

    wjs_main_loop_timer.Toc();

    if( ExitFlag ) // This ExitFlag can be set by any of the main-loop functions above.
    {
        // Print results of main-loop timing...
        wjs_main_loop_timer.Results();

        for( var i=0; (i < wjs_func_count); i++ )
        {
            wjs_func_timer_list[i].Results();
        };

        // Call the end function if it has been set.
        if( !wjs_isnull(wjs_end_func) )
        {
            wjs_end_func();
        };
    }
    else 
    {   // Schedule the next iteration of main-loop.
        wjs_main_loop_RAFid = window.requestAnimationFrame(wjs_main_loop_func); 
    };
}; // wjs_main_loop_func() 

// The main-loop start function (called at the start of each trial).
function wjs_main_loop(calc_func,state_func,display_func,end_func)
{
    wjs_main_loop_count = 0;

    wjs_frame_timestamp_array = [ ];
    wjs_frame_timestamp_last = 0;
    wjs_frame_count = 0;

    wjs_main_loop_timer.Reset();

    for( var i=0; (i < wjs_func_count); i++ )
    {
        wjs_func_timer_list[i].Reset();
    };

    wjs_func_list = [ calc_func,state_func,display_func ];
    wjs_calc_func = calc_func;
    wjs_state_func = state_func;
    wjs_display_func = display_func;
    wjs_end_func = end_func;
    
    // Start the main-loop running by scheduling an animation frame.
    wjs_main_loop_RAFid = window.requestAnimationFrame(wjs_main_loop_func); 
    // wjs_main_loop_func(0);
}; // wjs_main_loop()

/******************************************************************************/
// Setup the drawing canvas.
function wjs_canvas_setup(GraphicsMode,DisplayElement,PluginName,UpdateFunc,BackgroundColor)
{
    if( typeof(GraphicsMode) === 'string' )
    {   // GraphicsMode (if specified) is a string.
        GraphicsMode.toLowerCase();

        if( (GraphicsMode === '2d') || (GraphicsMode === '3d') )
        {
            wjs.graphics_mode = GraphicsMode;
        };
    }
    else
    {   // GraphicsMode parameter not specific, so shift parameters left.
        BackgroundColor = UpdateFunc;
        UpdateFunc = PluginName;
        PluginName = DisplayElement;
        DisplayElement = GraphicsMode;
    }

    wjs.display_element = DisplayElement;
    wjs.plugin_name = PluginName;
    wjs.canvas_name = `jspsych-${PluginName}-canvas`;
    wjs.canvas_update_func = UpdateFunc;
    wjs.background_color = wjs_isnull(BackgroundColor) ? null : BackgroundColor;

    // The document body is the jsPsych 'display_element' (<body class="jspsych-display-element"> .... </body>)
    wjs.body = document.getElementsByClassName("jspsych-display-element")[0];
		
    // Set document body style.
    wjs.body.style.margin = 0;
    wjs.body.style.padding = 0;
    wjs.body.style.overflow = 'hidden';
    wjs.body.style.width = '100%';
    wjs.body.style.height = '100%';
    //wjs.body.style.cursor = 'none';
    if( !wjs_isnull(wjs.background_color) )
    {   // Should match canvas to prevent flickers.
        wjs.body.style.backgroundColor = wjs.background_color; 
    };

    // Setup canvas element.
    wjs.canvas = document.createElement("canvas"); // Create
    wjs.canvas.setAttribute('id',wjs.canvas_name); // Assign an ID so we reference it.
    wjs.display_element.appendChild(wjs.canvas);  // Append to the DOM

    // Canvas style.
    wjs.canvas.style.position= 'absolute';
    wjs.canvas.style.top= '-9999px';
    wjs.canvas.style.bottom= '-9999px';
    wjs.canvas.style.left= '-9999px';
    wjs.canvas.style.right= '-9999px';
    wjs.canvas.style.margin = 'auto';
    if( !wjs_isnull(wjs.background_color) )
    {   // Should match body to prevent flickers.
        wjs.canvas.style.backgroundColor = wjs.background_color; 
    }

    // Get the context of the canvas so that it can be painted on.
    wjs.canvas_context = wjs.canvas.getContext("2d");

    wjs_debug_log('wjs_canvas_setup(...)');
    wjs_debug_log(wjs.canvas);

    wjs_canvas_update('start');
};

/******************************************************************************/
// Update the drawing canvas (if required).
function wjs_canvas_update(desc)
{
    // If the size of the window hasn't changed, do nothing.
    if( (wjs.canvas.width == window.innerWidth) && (wjs.canvas.height == window.innerHeight) )
    {
        return;
    }

    if( typeof(desc) === 'undefined' ) { desc = ''; };

    wjs_debug_log(`canvas(wid,hgt) previous=${wjs.canvas.width},${wjs.canvas.height} current=${window.innerWidth},${window.innerHeight} (${desc})`);

    wjs.canvas.width = window.innerWidth;
    wjs.canvas.height = window.innerHeight;

    // Application-defined canvas update function.
    if( !wjs_isnull(wjs.canvas_update_func) )
    {
        wjs.canvas_update_func();
    };
};

/******************************************************************************/
// Log debug messages to the console (if flag is set).
function wjs_debug_log(text)
{
    if( wjs_debug_log_flag )
    {
        console.log(text);
    };
};

/******************************************************************************/
// Standard miss-trial function, set flag and add text (if not already present).
function wjs_miss_trial(data,text)
{
    if( typeof(data.missTrial) === 'undefined' )
    {
        return;
    };

    var flag=false;

    data.missTrial = true;

    if( !data.missTrialMsg.includes(text) )
    {
        flag = true;
        data.missTrialMsg += text + ' ';
    };

    return(flag); // Returns true if the miss trial text was not already present.
};

/******************************************************************************/
// Draw a circle on the current canvas.
function wjs_color_string(ColorCode)
{
    var ColorString = 'white';

    if( typeof(ColorCode) === 'string' )
    {
        ColorString = ColorCode;
    }
    else
    if( Array.isArray(ColorCode) )
    {
        if( ColorCode.length === 3 )
        {
            ColorString = `rgb(${ColorCode.toString()})`;
        }
        else
        if( ColorCode.length === 4 )
        {
            ColorString = `rgba(${ColorCode.toString()})`;
        };
    };

    return(ColorString)
};

/******************************************************************************/
// Draw a circle on the current canvas.
function wjs_draw_circle(xy,radius,color,isFilled,width) 
{
    xy = wjs_xyvec(xy);

    if( radius <= 0.0 ) // Don't do anything in this case (obviously).
    { 
       return;
    };

    wjs.canvas_context.beginPath();
    wjs.canvas_context.arc(xy[0],xy[1],radius,0,2*Math.PI,false); 

    if( isFilled ) 
    {
        wjs.canvas_context.fillStyle = wjs_color_string(color);
        wjs.canvas_context.fill();
    };

    if( typeof(width) !== 'undefined' )
    {
        wjs.canvas_context.lineWidth = width;
        wjs.canvas_context.strokeStyle = wjs_color_string(color);
        wjs.canvas_context.stroke();
    };
};

/******************************************************************************/
// Draw some text.
function wjs_draw_text(xy,string,fontSize,color,style)
{
    if( wjs_isnull(style) ) { style = '' } else { style = style + ' '; };

    xy = wjs_xyvec(xy);

    wjs.canvas_context.font = style + fontSize.toString() + 'pt Helvetica';
    wjs.canvas_context.fillStyle = wjs_color_string(color);
    wjs.canvas_context.textAlign = 'center';
    var lines = string.split('\n'); // in case of multiple lines of text, split at '\n'

    for( var j=0; (j < lines.length); j++ )
    {
        wjs.canvas_context.fillText(lines[j],xy[0],xy[1]+(j*2*fontSize));
    };
};

/******************************************************************************/
// Draw a rectangle.
function wjs_draw_rectangle(xy,width,height,color)
{
    wjs.canvas_context.fillStyle = wjs_color_string(color);
    wjs.canvas_context.fillRect(wjs_xyvec(xy,0),wjs_xyvec(xy,1),width,height);
    wjs.canvas_context.restore();
};

/******************************************************************************/
// Draw a line
function wjs_draw_line(x, y, color, width) { 
    wjs.canvas_context.beginPath();
    wjs.canvas_context.moveTo(x[0], y[0]);
    for(var i =1;i<=x.length-1;i++){
        wjs.canvas_context.lineTo(x[i], y[i]);
    }
    wjs.canvas_context.lineJoin = 'round';
    wjs.canvas_context.lineCap = 'round';
    // wjs.canvas_context.setLineDash([10, 10]);
    wjs.canvas_context.strokeStyle = wjs_color_string(color);
    wjs.canvas_context.lineWidth = width;
    wjs.canvas_context.stroke();
}    

// Draw a shape
function wjs_draw_shape(x, y, color) { 
    wjs.canvas_context.beginPath();
    wjs.canvas_context.moveTo(x[0], y[0]);
    for(var i =1;i<=x.length-1;i++){
        wjs.canvas_context.lineTo(x[i], y[i]);
    }
    wjs.canvas_context.closePath();
    wjs.canvas_context.fillStyle = wjs_color_string(color);
    wjs.canvas_context.fill();
}

// Draw a image
function wjs_draw_image(image,x,y,cx,cy,angle){
    wjs.canvas_context.save();

    wjs.canvas_context.translate(cx, cy);
    wjs.canvas_context.rotate(angle);// clockwise
    wjs.canvas_context.translate(-cx, -cy);
    wjs.canvas_context.drawImage(image, x[3], y[3], x[1]-x[0], y[0]-y[2]);
    // Restore the default state
    wjs.canvas_context.restore();
}
/******************************************************************************/
// Draw a pie shape.
function wjs_draw_pie(xy,radius,angle1,angle2,color)
{
    var x = wjs_xyvec(xy,0);
    var y = wjs_xyvec(xy,1);

    wjs.canvas_context.beginPath();
    wjs.canvas_context.moveTo(x,y);
    wjs.canvas_context.arc(x,y,radius,angle1*Math.PI/180,angle2*Math.PI/180,false);
    wjs.canvas_context.fillStyle = wjs_color_string(color);  
    wjs.canvas_context.fill();
    wjs.canvas_context.closePath(); 
};

/******************************************************************************/
// Exploding target class.
class wjs_target_explode 
{
    TargetX;
    TargetY;
    TargetRGB;
    Duration;
    Fragments;
    FragmentSize;
    Speed;
    Size = 1;
    FadeToRGB = [ 0,0,0 ];
    FadeRGB;

    PoppingFlag;
    Timer;

    constructor(TargetXY,TargetRGB,Duration,Fragments,FragmentSize,Speed)
    {
        this.PoppingFlag = false;
        this.Timer = new wjs_timer('wjs_target_explode');

        this.TargetX = wjs_xyvec(TargetXY,0);
        this.TargetY = wjs_xyvec(TargetXY,1);
        this.TargetRGB = TargetRGB;
        this.Duration = Duration;
        this.Fragments = Fragments;
        this.FragmentSize = FragmentSize;
        this.Speed = Speed;

        if( typeof(Size) !== 'undefined' )
        {
            this.Size = Size;
        };

        this.FadeRGB = wjs_color_gradient(this.TargetRGB,this.FadeToRGB,Math.floor(this.Duration/10));
    };

    Pop = function(TargetXY)
    {
        if( this.PoppingFlag )
        {
            return;
        };

        if( typeof(TargetXY) !== 'undefined' )
        {
            this.TargetX = wjs_xyvec(TargetXY,0);
            this.TargetY = wjs_xyvec(TargetXY,1);
        };

        this.PoppingFlag = true;
        this.Timer.Reset();
    };

    Done = function()
    {
        return(!this.PoppingFlag);
    };

    Display = function()
    {
        if( this.Timer.ExpiredMSec(this.Duration) )
        {
            this.PoppingFlag = false;
            return;
        }

        var t = this.Timer.ElapsedMSec();
        var radius = (this.Duration-t)/this.Duration*this.FragmentSize/2;
        var angle;
        var x;
        var y;
        var RGB = this.FadeRGB[Math.floor(t/10)];

        for( var i=0; (i < this.Fragments); i++ )
        {
            angle = 2*Math.PI*i/this.Fragments;
            x = this.TargetX + (Math.sin(angle) * ((this.Speed*t) + (0.8*this.Size)));
            y = this.TargetY + (Math.cos(angle) * ((this.Speed*t) + (0.8*this.Size)));

            wjs_draw_circle([x,y],radius,'rgb(' + RGB + ')',true,2);
        };
    };
};

/******************************************************************************/
// Returns true if full-screen mode engaged.
function wjs_fullscreen_flag()
{
  var FS = (typeof(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement) !== 'undefined');
  return(FS);
};

/******************************************************************************/
// Returns true if pointer-lock engaged.
function wjs_pointerlock_flag()
{
  var PS = (document.pointerLockElement === document.body) || (document.mozPointerLockElement === document.body);
  return(PS);
};

/******************************************************************************/
// Prompt user to enter full screen.
function wjs_fullscreen_enter() 
{
  var canvasElement = document.getElementById(wjs.canvas_name);
  var buttonResponseStimulusElement = document.getElementById('jspsych-html-button-response-stimulus');
  var buttonResponseButtonsElement = document.getElementById('jspsych-html-button-response-btngroup');

  wjs_debug_log(`wjs_fullscreen_enter()`);
  wjs_debug_log(`canvasElement: ${typeof(canvasElement)} ${canvasElement}`);
  wjs_debug_log(`buttonResponseStimulusElement: ${typeof(buttonResponseStimulusElement)} ${buttonResponseStimulusElement}`);
  wjs_debug_log(`buttonResponseButtonsElement: ${typeof(buttonResponseButtonsElement)} ${buttonResponseButtonsElement}`);

  /*var x = (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
  wjs_debug_log(`fullscreen: ${typeof(x)} ${x}`);*/
    
  if(canvasElement!==null){
    canvasElement.style.display = 'none';
  }else{
    buttonResponseStimulusElement.style.display = 'none';
    buttonResponseButtonsElement.style.display = 'none';
  }
  
  var trial_content_container = document.getElementById('jspsych-content');
  
  var fullscreenDiv = document.createElement('div');
  fullscreenDiv.innerHTML = '<h3>This experiment must be run in full-screen.</h3><br>' +
  '<button id="jspsych-fullscreen-btn" class="jspsych-btn">Enter full screen mode</button>';
  
  trial_content_container.appendChild(fullscreenDiv);
  
  var fullScreenButton = $('#jspsych-fullscreen-btn')[0];
  
  $('body').css('cursor', 'auto');
  
  var listener = fullScreenButton.addEventListener('click', function(){
    wjs_xy2xy(wjs.mouse,[0,0]); // Reset mouse position.
    var element = document.documentElement;
    if (element.requestFullscreen) { element.requestFullscreen(); }
    else if (element.mozRequestFullScreen) { element.mozRequestFullScreen(); }
    else if (element.webkitRequestFullscreen) { element.webkitRequestFullscreen(); }
    else if (element.msRequestFullscreen) { element.msRequestFullscreen(); }
    
    trial_content_container.removeChild(fullscreenDiv);
    
    setTimeout( function(){
      /*wjs_debug_log('wjs_fullscreen_on_exit().onTimeout()');
      var x = (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);
      wjs_debug_log(`fullscreen: ${typeof(x)} ${x}`);*/

      if(canvasElement!==null){
        canvasElement.style.removeProperty('display'); // stop hiding the canvas
      }else{
        buttonResponseStimulusElement.style.removeProperty('display');
        buttonResponseButtonsElement.style.removeProperty('display');
      }
    }, 200);
    
  })
}; // wjs_fullscreen_enter()

/******************************************************************************/
// Start pointer-lock.
function wjs_pointerlock_start()
{
    document.body.requestPointerLock = document.body.requestPointerLock || document.body.mozRequestPointerLock;
    document.body.requestPointerLock();
};

/******************************************************************************/
// Stop pointer-lock.
function wjs_pointerlock_stop()
{
    document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock;
    document.exitPointerLock();
};

/******************************************************************************/
// Application-specific event callbacks functions, etc.
var wjs_mouse_move_func=null;
var wjs_mouse_click_func=null;
var wjs_window_resize_func=null;
var wjs_pointerlock_change_func=null;

function wjs_event_func(func,event)
{
    if( !wjs_isnull(func) )
    {
        func(event);
    };
};

/******************************************************************************/
// Start event handlers.
function wjs_event_start(mouse_move_func,mouse_click_func,resize_func,pointerlock_change_func)
{
    wjs_event_stop(); // Stop first, just in case, so we don't start multiple event handlers.

    wjs_mouse_move_func = mouse_move_func;
    wjs_mouse_click_func = mouse_click_func;
    wjs_resize_func = resize_func;
    wjs_pointerlock_change_func = pointerlock_change_func;
    
    wjs_event_pointerlock_start();

    document.addEventListener('mousemove',wjs_event_mouse_move);
    wjs.canvas.addEventListener('click',wjs_event_mouse_click);

    window.onresize = wjs_event_resize;
};

/******************************************************************************/
// Stop event handlers.
function wjs_event_stop()
{
    document.removeEventListener('mousemove',wjs_event_mouse_move,false);
    wjs.canvas.removeEventListener('click', wjs_event_mouse_click,false);

    wjs_event_pointerlock_stop();

    wjs_mouse_move_func = null;
    wjs_mouse_click_func = null;
    wjs_resize_func = null;
    wjs_pointerlock_change_func = null;
};

/******************************************************************************/
// Start pointer-lock event handlers.
function wjs_event_pointerlock_start()
{
    wjs_event_pointerlock_stop(); // Stop first, to avoid starting multiple event handlers.

    if( "onpointerlockchange" in document )
    {
        document.addEventListener('pointerlockchange',wjs_event_pointerlock_change,false);
        document.addEventListener('pointerlockerror',wjs_event_pointerlock_error,false);
    } 
    else 
    if( "onmozpointerlockchange" in document ) 
    {
        document.addEventListener('mozpointerlockchange',wjs_event_pointerlock_change,false);
        document.addEventListener('mozpointerlockerror',wjs_event_pointerlock_error,false);
    };
};

/******************************************************************************/
// Start pointer-lock event handlers.
function wjs_event_pointerlock_stop()
{
    if( "onpointerlockchange" in document ) 
    {
        document.removeEventListener('pointerlockchange',wjs_event_pointerlock_change,false);
        document.removeEventListener('pointerlockerror',wjs_event_pointerlock_error,false);
    } 
    else 
    if( "onmozpointerlockchange" in document ) 
    {
        document.removeEventListener('mozpointerlockchange',wjs_event_pointerlock_change,false);
        document.removeEventListener('mozpointerlockerror',wjs_event_pointerlock_error,false);
    };
};

/******************************************************************************/
// Mouse movement event handler.
function wjs_event_mouse_move(event) 
{ 
    event = event || window.event; // Support for IE?

    var rect = wjs.canvas.getBoundingClientRect();
    wjs.mouse.x = event.clientX-rect.left;
    wjs.mouse.y = event.clientY-rect.top;

    if( !wjs_pointerlock_flag() )
    { // Nothing else to do if not in pointer-lock.
        return;
    }

    wjs.cursor.velocity.x = event.movementX;
    wjs.cursor.velocity.y = event.movementY;

    wjs.cursor.x += wjs.cursor.velocity.x;
    wjs.cursor.y += wjs.cursor.velocity.y;

    wjs.cursor.x = wjs_clamp(wjs.cursor.x,1,wjs.canvas.width);
    wjs.cursor.y = wjs_clamp(wjs.cursor.y,0,wjs.canvas.height-54); // Less for progress bar.

    wjs.cursor.time_stamp = event.timeStamp;

    wjs_event_func(wjs_mouse_move_func,event); // Application-specific function.
}

/******************************************************************************/
// Mouse click event hanlder.
function wjs_event_mouse_click(event)
{
    event = event || window.event; // Support for IE?

    // Mouse click used to engage pointer-lock, so do nothing if already engaged.
    if( wjs_pointerlock_flag() )
    {
        return;
    }

    // Wait for mouse to be at the pointer-lock  
    if( !wjs_ishome(wjs.mouse,wjs.home,wjs.home.radius) ) 
    {
        return;
    }

    wjs_pointerlock_start(); // Engage pointer-lock.

    wjs_event_pointerlock_start(); // Start pointer-lock event handlers (in case cleared?).

    wjs.cursor.x = wjs.mouse.x; 
    wjs.cursor.y = wjs.mouse.y;

    wjs_event_func(wjs_mouse_click_func,event); // Application-specific function.
};

/******************************************************************************/
// Window resize event handler.
function wjs_event_resize(event)
{
    wjs_event_func(wjs_resize_func,event);
};

/******************************************************************************/
// Pointer-lock change event handler.
function wjs_event_pointerlock_change(event) 
{
    var FS = wjs_fullscreen_flag();
    var PL = wjs_pointerlock_flag();
    wjs_debug_log(`Pointer-lock change event: FS=${FS}, PL=${PL}`);

    if( !PL )
    { 
        wjs_xy2xy(wjs.mouse,[0,0]); // Reset mouse position.
    };

    wjs_event_func(wjs_pointerlock_change_func,event);
};

/******************************************************************************/
// Pointer-lock error event handler.
function wjs_event_pointerlock_error(event) 
{
    alert('Pointer-lock request failed.'); 
};

/******************************************************************************/
// Firebase trial-save function.
function wjs_firebase_trial_save(trialdata)
{
    for (var tdi in trialdata){
      if (trialdata.hasOwnProperty(tdi)){ // filter out prototype-chain object properties
        // Firebase Won't write null, [], or NaN
        if ((Array.isArray(trialdata[tdi]) && trialdata[tdi].length===0) || trialdata[tdi]===null || Number.isNaN(trialdata[tdi] || isNaN(trialdata[tdi]))){
          trialdata[tdi] = ""; // this is a good substitute
        }
      }
    }
    var ti = trialdata.trial_index;
    ti = ti.toString().padStart(3,'0');
    if (wjs_sizeof(trialdata)/1000 > 100){ // Make this warning limit a parameter.
      console.log('SAVE WARNING: sizeof(trialdata) > 100 KB')
    }
    if (typeof(firebase)!=="undefined"){
      var ref = firebase.database().ref('experiments/' + wjs_experiment_name + '/' + wjs_firebase_uid + '/' + ti)
      .set(trialdata, function(error) {
        if (error) {
          console.log('SAVE ERROR: Failed to save data to Firebase.');
        }
      });
    }else{
      console.log('SAVE ERROR: Not connected to Firebase.')
    }
};
  
/******************************************************************************/
// Firebase sign-in function.

function wjs_firebase_signin()
{
    if (typeof(firebase) !== 'undefined'){
        firebase.auth().signInAnonymously() // Sign in user anonymously
        .then(function(uc){ // Once Promise<UserCredentials> returns
          wjs_firebase_uid = uc.user.uid;
          wjs_firebase_signInMetadata = uc.user.metadata;
        })
        .catch(function(error) {
          // Handle errors
          var errorCode = error.code;
          var errorMessage = error.message;
          if (errorCode === 'auth/operation-not-allowed') {
            alert('You must enable Anonymous auth in the Firebase Console.');
          } else {
            console.error(error);
          }
        });
    } // end if(typeof(firebase) !== 'undefined')
};
   
/******************************************************************************/
// Firebase sign-in function.
/*function wjs_firebase_signout()
{
    firebase.auth().signOut().then(function() {// Promise<void>
      // Sign-out successful.
      console.log('Signed out ' + wjs_firebase_uid);
    }).catch(function(error) {
      var errorCode = error.code;
      var errorMessage = error.message;
      console.log(error.message);
      // An error happened.
      console.log('ERROR: Sign-out failed.')
    });
}*/

/******************************************************************************/
// Get high-perfomance timer current time in seconds.
function wjs_get_secs()
{
    return(performance.now()/1000.0);
};

/******************************************************************************/
// Return true of a variable is undefined or null.
function wjs_isnull(value)
{
    var flag = (typeof(value) === 'undefined') || (value === null);

    return(flag);
};

/******************************************************************************/
// Calculate basic statistics for an array of numbers.
function wjs_array_stats(array_object) 
{
    var stats = { };
    var n = array_object.length;
    var mean = 0.0;
    var variance = 0.0;
    var sd = 0.0;
    var i;
    var d;

    for( i=0; (i < n); i++ ) 
    {
        mean += array_object[i];
    };

    if( n != 0 ) 
    {
        mean /= n;
    }

    if( n > 1 ) 
    {
        for( d,i=0; (i < n); i++ ) 
        {
            d = array_object[i] - mean;
            variance += (d * d);
        }

        variance /= (n-1);
        sd = Math.sqrt(variance);
    }

    stats.n = n;
    stats.mean = mean;
    stats.variance = variance;
    stats.sd = sd;

    return(stats);
};

/******************************************************************************/
// Round a value to specified number of decimal places.
function wjs_round(value,places)
{
    if( typeof(places) == 'undefined' )
    {
        places = 0;
    }

    for( var m=1.0,i=0; (i < places); i++ )
    {
        m *= 10.0;
    };

    value = Math.round(value * m) / m;

    return(value);
};

/******************************************************************************/
// Curent date and time as a string.
function wjs_date_string()
{
    var date = new Date();
    var Yr = date.getFullYear().toString();
    var Mo = ('0' + (date.getMonth() + 1)).slice(-2); // JavaScript Date object has 0-indexed months
    var Dy = ('0' + date.getDate()).slice(-2);
    var Hr = ('0' + date.getHours()).slice(-2);
    var Mi = ('0' + date.getMinutes()).slice(-2);
    var Se = ('0' + date.getSeconds()).slice(-2);

    return(Yr+Mo+Dy+'_'+Hr+Mi+Se);
};

/******************************************************************************/
// Crurent date and time as an object.
function wjs_date_object()
{
    var date = new Date();
    var formattedYear = date.getFullYear().toString();
    var formattedMonth = ('0' + (date.getMonth() + 1)).slice(-2); // JavaScript Date object has 0-indexed months
    var formattedDate = ('0' + date.getDate()).slice(-2);
    var formattedHours = ('0' + date.getHours()).slice(-2);
    var formattedMinutes = ('0' + date.getMinutes()).slice(-2);
    var formattedSeconds = ('0' + date.getSeconds()).slice(-2);
    
    var dateStringObject = 
    {
        year: formattedYear,
        month: formattedMonth,
        date: formattedDate,
        hours: formattedHours,
        minutes: formattedMinutes,
        seconds: formattedSeconds,
    };

    return dateStringObject;
};

/******************************************************************************/
// Returns a string value that is padded with characters to be a specified length.
function wjs_pad(leading,value,length,padding)
{
    if( typeof(padding) === 'undefined' )
    {
        padding = ' ';
    };

    var str = String(value);

    for(  var i=str.length; (i < length); i++ )
    {
        if( leading )
        {
            str = padding + str;
        }
        else
        {
            str = str + padding;
        };
    };

    return(str);
};

/******************************************************************************/
// Returns a string value that is padded with leading characters.
function wjs_pad_leading(value,length,padding)
{
    var str = wjs_pad(true,value,length,padding); // TRUE = pad leading.

    return(str);
};

/******************************************************************************/
// Returns a string value that is padded with trailing characters.
function wjs_pad_trailing(value,length,padding)
{
    var str = wjs_pad(false,value,length,padding); // FALSE = pad trailing.

    return(str);
};

/******************************************************************************/
// Generate a color gradient (an array of RGB value) between two colors.
function wjs_color_gradient(start,end,steps) 
{
var i,j,wStart,wEnd,output=[ ];

    for (i = 0; i < steps; i++) 
    {
        var combinedRGB = [];
        wStart = i / (steps - 1);
        wEnd = 1 - wStart;
        for (j = 0; j < 3; j++) {
            combinedRGB[j] = Math.round(start[j] * wEnd + end[j] * wStart);
        }

        output.push(combinedRGB);
    };

    return output;
};
  
/******************************************************************************/
// Function returns an [x,y] array whether passed an array or an object.
function wjs_xyvec(xy,index)
{
var xyvec;

    if( Array.isArray(xy) )
    {   // Already an array...
        xyvec = xy;
    }
    else
    {   // Otherwise, assume xy is an object.
        xyvec = [ ];
        xyvec[0] = xy.x;
        xyvec[1] = xy.y;
    };

    // Return the array vector (or a single element if specified).
    return((typeof(index) === 'undefined') ? xyvec : xyvec[index]);
};

/******************************************************************************/
// Set x,y values of xy1 to x,y values of xy2 (arrays or objects).
function wjs_xy2xy(xy1,xy2)
{
    var xy2vec = wjs_xyvec(xy2);

    if( Array.isArray(xy1) )
    {
        xy1[0] = xy2vec[0];
        xy1[1] = xy2vec[1];
    }
    else
    {
        xy1.x = xy2vec[0];
        xy1.y = xy2vec[1];
    };
};

/******************************************************************************/
// Calculate Euclidean length of a vector or the distance between two points.
function wjs_distance(p1,p2)
{
var d=0.0;

    var v1 = wjs_xyvec(p1);
    var v2 = [ 0,0 ];

    if( typeof(p2) !== 'undefined' )
    {
        v2 = wjs_xyvec(p2);
    };

    for( var i=0; (i < v1.length); i++ )
    {
        d += Math.pow(v1[i]-v2[i],2);
    }

    return(Math.sqrt(d));
};
  
/******************************************************************************/
// Return true if x,y position inside target.
function wjs_ishome(cursor,target,tolerance)
{
    var d = wjs_distance(cursor,target);

    return(d < tolerance);
};

/******************************************************************************/
// Clamp a variable between minimum and maximum values.
function wjs_clamp(value,min,max)
{
    if( value > max )
    {
        value = max;
    }
    else
    if( value < min )
    {
        value = min;
    };

    return(value);
};

/******************************************************************************/
// Clear trial feedback text.
function wjs_trial_feedback_clear()
{
    wjs.trial_feedback_text = '';
}

/******************************************************************************/
// Set trial feedback text (with option duration at which feedback is cleared).
function wjs_trial_feedback_set(FeedbackText,FeedbackDuration)
{
    wjs.trial_feedback_text = FeedbackText;
    if( FeedbackDuration > 0 )
    {
        setTimeout(wjs_trial_feedback_clear,FeedbackDuration);
    }
};
  
/******************************************************************************/
// Get browser information.
function wjs_browser_get() 
{ 
    var ua = navigator.userAgent, tem, 
    M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || []; 
    if(/trident/i.test(M[1])) { 
      tem=  /\brv[ :]+(\d+)/g.exec(ua) || []; 
      return 'IE '+(tem[1] || ''); 
    } 
    if(M[1]=== 'Chrome') { 
      tem= ua.match(/\b(OPR|Edge)\/(\d+)/); 
      if(tem!= null) 
      return tem.slice(1).join(' ').replace('OPR', 'Opera'); 
    } 
    M = M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?']; 
    if((tem= ua.match(/version\/(\d+)/i))!= null) 
      M.splice(1, 1, tem[1]); 
    return { 'browser': M[0], 'version': M[1] }; 
};
  
/******************************************************************************/
// Get browser information.
function wjs_browser_check(IncludeList,ExcludeList)
{
    var browserInfo = wjs_browser_get();
    var browserOK;
    
    if( !wjs_isnull(IncludeList) )
    {
        if( !Array.isArray(IncludeList) ) { IncludeList = [ IncludeList ]; };

        browserOK = false;
        for( var i=0; ((i < IncludeList.length) && !browserOK); i++ )
        {
            browserOK = browserInfo.browser.includes(IncludeList[i]);
        };
    }
    else
    if( !wjs_isnull(ExcludeList) )
    {
        if( !Array.isArray(ExcludeList) ) { ExcludeList = [ ExcludeList ]; };

        browserOK = true;
        for( var i=0; ((i < ExcludeList.length) && browserOK); i++ )
        {
            browserOK = !browserInfo.browser.includes(ExcludeList[i]);
        };
    };

    return(browserOK);
};

/******************************************************************************/
// Get OS information.
function wjs_os_get() 
{ 
var OSName = 'Unknown';

    if (window.navigator.userAgent.indexOf('Windows NT 10.0')!= -1) OSName='Windows 10';
    if (window.navigator.userAgent.indexOf('Windows NT 6.2') != -1) OSName='Windows 8';
    if (window.navigator.userAgent.indexOf('Windows NT 6.1') != -1) OSName='Windows 7';
    if (window.navigator.userAgent.indexOf('Windows NT 6.0') != -1) OSName='Windows Vista';
    if (window.navigator.userAgent.indexOf('Windows NT 5.1') != -1) OSName='Windows XP';
    if (window.navigator.userAgent.indexOf('Windows NT 5.0') != -1) OSName='Windows 2000';
    if (window.navigator.userAgent.indexOf('Mac')            != -1) OSName='Mac/iOS';
    if (window.navigator.userAgent.indexOf('X11')            != -1) OSName='UNIX';
    if (window.navigator.userAgent.indexOf('Linux')          != -1) OSName='Linux';
    return OSName;
};

/******************************************************************************/
// Estimate the size (in bytes) of a variable (3rd party).
function wjs_sizeof(_1)
{
var _2=[_1];
var _3=0;

    for(var _4=0;_4<_2.length;_4++)
    {
        switch(typeof _2[_4])
        {
            case "boolean":
                _3+=4;
                break;

            case "number":
                _3+=8;
                break;
            case "string":
                _3+=2*_2[_4].length;
                break;

            case "object":
                if(Object.prototype.toString.call(_2[_4])!="[object Array]")
                {
                    for(var _5 in _2[_4])
                    {
                        _3+=2*_5.length;
                    }
                }

                for(var _5 in _2[_4])
                {
                    var _6=false;
                    for(var _7=0;_7<_2.length;_7++)
                    {
                        if(_2[_7]===_2[_4][_5])
                        {
                            _6=true;
                            break;
                        }
                    }

                    if(!_6)
                    {
                        _2.push(_2[_4][_5]);
                    }
                }
                break;
        }
    }

    return _3;
};

/******************************************************************************/
