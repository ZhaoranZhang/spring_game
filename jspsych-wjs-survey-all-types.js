/*
 * jspsych-wjs-survey-all-types
 * a jspsych plugin for multiple choice survey questions
 *
 * Shane Martin
 *
 * documentation: docs.jspsych.org
 *
 */

jsPsych.plugins['wjs-survey-all-types'] = (function() {
  var plugin = {};

  plugin.info = {
    name: 'wjs-survey-all-types',
    description: '',
    parameters: {
      questions: {
        type: jsPsych.plugins.parameterType.COMPLEX,
        array: true,
        pretty_name: 'Questions',
        nested: {
          prompt: {
            type: jsPsych.plugins.parameterType.STRING,
            pretty_name: 'Prompt',
            default: undefined,
            description: 'The strings that will be associated with a group of options.'
          },
          options: {
            type: jsPsych.plugins.parameterType.STRING,
            pretty_name: 'Options',
            array: true,
            default: "",
            description: 'Displays options for an individual question.'
          },
          horizontal: {
            type: jsPsych.plugins.parameterType.BOOL,
            pretty_name: 'Horizontal',
            default: false,
            description: 'If true, then questions are centered and options are displayed horizontally.'
          },
          placeholder: {
            type: jsPsych.plugins.parameterType.STRING,
            pretty_name: 'Value',
            default: "",
            description: 'Placeholder text in the textfield.'
          },
          rows: {
            type: jsPsych.plugins.parameterType.INT,
            pretty_name: 'Rows',
            default: 1,
            description: 'The number of rows for the response text box.'
          },
          columns: {
            type: jsPsych.plugins.parameterType.INT,
            pretty_name: 'Columns',
            default: 40,
            description: 'The number of columns for the response text box.'
          },
          required: {
            type: jsPsych.plugins.parameterType.BOOL,
            pretty_name: 'Required',
            default: false,
            description: 'Subject will be required to pick at least one option for this question.'
          },
          name: {
            type: jsPsych.plugins.parameterType.STRING,
            pretty_name: 'Question Name',
            default: "",
            description: 'Controls the name of data values associated with this question'
          },
          question_type: {
            type: jsPsych.plugins.parameterType.STRING,
            pretty_name: 'Required message',
            default: 'multichoice',
            description: 'Type of question.'
          },
          value_limit: {
            type: jsPsych.plugins.parameterType.INT,
            pretty_name: 'Options',
            default: "",
            description: 'Type of question.'
          },
          hidden: {
            type: jsPsych.plugins.parameterType.BOOL,
            pretty_name: 'Question is hidden',
            default: false,
            description: 'Indicates whether question is initially displayed.'
          }
        }
      },
      randomize_question_order: {
        type: jsPsych.plugins.parameterType.BOOL,
        pretty_name: 'Randomize Question Order',
        default: false,
        description: 'If true, the order of the questions will be randomized'
      },
      preamble: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Preamble',
        default: null,
        description: 'HTML formatted string to display at the top of the page above all the questions.'
      },
      button_label: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Button label',
        default:  'Continue',
        description: 'Label of the button.'
      },
      required_message: {
        type: jsPsych.plugins.parameterType.STRING,
        pretty_name: 'Required message',
        default: 'You must choose at least one response for this question',
        description: 'Message that will be displayed if required question is not answered.'
      },
    }
  }

  plugin.trial = function(display_element, trial) {
    var plugin_id_name = "jspsych-wjs-survey-all-types";
    var html = "";
    // console.log(trial.questions[0].question_type);
   
    // inject CSS for trial
    html += '<style id="jspsych-wjs-survey-all-types-css">';
    html += ".jspsych-wjs-survey-all-types-question {margin-top: 1em; margin-bottom: 1em; text-align: left; }"+
      ".jspsych-wjs-survey-all-types-question .jspsych-wjs-survey-all-types-text { margin: 0; }"+
      ".jspsych-wjs-survey-all-types-preamble { text-align: left; }"+
      ".jspsych-wjs-survey-all-types-text span.required {color: red;}"+
      //".jspsych-wjs-survey-all-types-horizontal .jspsych-wjs-survey-all-types-text {  text-align: center;}"+
      ".jspsych-wjs-survey-all-types-option { line-height: 2; }"+
      ".jspsych-wjs-survey-all-types-horizontal .jspsych-wjs-survey-all-types-option {display: inline-block;  margin-left: 1em;  margin-right: 1em;  vertical-align: top;}"+
      "label.jspsych-wjs-survey-all-types-text input[type='radio'] {margin-right: 1em;}";
    html += '</style>';
    
    // show preamble text
    if(trial.preamble !== null){
      html += '<div id="jspsych-wjs-survey-all-types-preamble" class="jspsych-wjs-survey-all-types-preamble">'+trial.preamble+'</div>';
    }

    // form element
    html += '<form id="jspsych-wjs-survey-all-types-form">';
  
    // generate question order. this is randomized here as opposed to randomizing the order of trial.questions
    // so that the data are always associated with the same question regardless of order
    var question_order = [];
    for(var i=0; i<trial.questions.length; i++){
      question_order.push(i);
    }
    if(trial.randomize_question_order){
      question_order = jsPsych.randomization.shuffle(question_order);
    }

    // add all questions
    for (var i = 0; i < trial.questions.length; i++) {
      
      // MULTIPLE CHOICE
      if(trial.questions[i].question_type=='multichoice'){
        // get question based on question_order
        var question = trial.questions[question_order[i]];
        var question_id = question_order[i];
        
        // create question container
        var question_classes = ['jspsych-wjs-survey-all-types-question'];
        if (question.horizontal) {
          question_classes.push('jspsych-wjs-survey-all-types-horizontal');
        }
        html += '<div id="jspsych-wjs-survey-all-types-'+question_id+'" class="'+question_classes.join(' ')+'"  data-name="'+question.name+'">';

        // add question text
        html += '<p class="jspsych-wjs-survey-all-types-text survey-multi-choice">' + question.prompt 
        if(question.required){
          html += "<span class='required'>*</span>";
        }
        html += '</p>';

        // create option radio buttons
        for (var j = 0; j < question.options.length; j++) {
          // add label and question text
          var option_id_name = "jspsych-wjs-survey-all-types-option-"+question_id+"-"+j;
          var input_name = 'jspsych-wjs-survey-all-types-response-'+question_id;
          var input_id = 'jspsych-wjs-survey-all-types-response-'+question_id+'-'+j;

          var required_attr = question.required ? 'required' : '';

          // add radio button container
          html += '<div id="'+option_id_name+'" class="jspsych-wjs-survey-all-types-option">';
          html += '<input type="radio" name="'+input_name+'" id="'+input_id+'" value="'+question.options[j]+'" '+required_attr+'></input>';
          html += '<label class="jspsych-wjs-survey-all-types-text" for="'+input_id+'">'+' '+question.options[j]+'</label>';
          html += '</div>';
        }

        html += '</div>';
      }
      
      // TEXT FIELDS
      else if (trial.questions[i].question_type=='text') {
        if (typeof trial.questions[i].rows == 'undefined') {
          trial.questions[i].rows = 1;
        }
        if (typeof trial.questions[i].columns == 'undefined') {
          trial.questions[i].columns = 40;
        }
        if (typeof trial.questions[i].value == 'undefined') {
          trial.questions[i].value = "";
        }
        var question = trial.questions[question_order[i]];
        var question_index = question_order[i];
        
        // create question container
        html += '<div id="jspsych-wjs-survey-all-types-'+question_index+'" class="jspsych-wjs-survey-all-types-question" style="margin: 1em 0em;">';
        
        // Add question text
        html += '<p class="jspsych-wjs-survey-all-types-text">' + question.prompt;
        if(question.required){
          html += "<span class='required'>*</span>";
        }
        html += '</p>';
        
        var autofocus = i == 0 ? "autofocus" : "";
        var req = question.required ? "required" : "";
        
        // Add the input field
        if(question.rows == 1){
          html += '<input type="text" id="input-'+question_index
                    +'"  name="#jspsych-wjs-survey-all-types-response-' + question_index 
                    + '" data-name="'+question.name+'" size="'+question.columns
                    +'" '+autofocus+' '+req+' placeholder="'+question.placeholder+'"></input>';
        }else{
          html += '<textarea id="input-'+question_index
                    +'" name="#jspsych-wjs-survey-all-types-response-' + question_index 
                    + '" data-name="'+question.name+'" cols="' + question.columns 
                    + '" rows="' + question.rows + '" '+autofocus+' '+req
                    +' placeholder="'+question.placeholder+'"></textarea>';
        }
        html += '</div>';  
      }
      
      // NUMERIC FIELDS
      else if (trial.questions[i].question_type=='num') {
        trial.questions[i].rows = 1;
        var question = trial.questions[question_order[i]];
        var question_index = question_order[i];
        
        // create container
        html += '<div id="jspsych-wjs-survey-all-types-'+question_index+'" class="jspsych-wjs-survey-all-types-question" style="margin: 1em 0em;">';
        
        // add question text
        html += '<p class="jspsych-wjs-survey-all-types-text">' + question.prompt;
        if(question.required){
          html += "<span class='required'>*</span>";
        }
        html += '</p>';
        
        // add input field
        var autofocus = i == 0 ? "autofocus" : "";
        var req = question.required ? "required" : "";
        html += '<input type="number" id="input-'+question_index
                    +'" name="#jspsych-wjs-survey-all-types-response-' + question_index 
                    +'" style="width: 10em;" '+ 'data-name="'+question.name
                    +'" min="'+question.value_limit[0]+'" max="'+question.value_limit[1]
                    +'" '+autofocus+' '+req+' placeholder="'+question.placeholder+'"></input>';
        html += '</div>';  
      }
      
      // DATE FIELDS
      else if (trial.questions[i].question_type=='date') {
        trial.questions[i].rows = 1;
        var question = trial.questions[question_order[i]];
        var question_index = question_order[i];
        html += '<div id="jspsych-wjs-survey-all-types-'+question_index+'" class="jspsych-wjs-survey-all-types-question" style="margin: 1em 0em;">';
        html += '<p class="jspsych-wjs-survey-all-types-text">' + question.prompt + '</p>';
        var autofocus = i == 0 ? "autofocus" : "";
        var req = question.required ? "required" : "";
        html += '<input type="date" id="input-'+question_index+'"  name="#jspsych-wjs-survey-all-types-response-' + question_index + '" data-name="'+question.name+'" min="1900-01-01" max="2003-12-31" placeholder="'+question.placeholder+'"></input>';
        html += '</div>';  
      }        

    }

    // add submit button
    html += '<input type="submit" id="'+plugin_id_name+'-next" class="'+plugin_id_name+' jspsych-btn"' + (trial.button_label ? ' value="'+trial.button_label + '"': '') + '></input>';
    html += '</form>';
    display_element.innerHTML = html;
    //display_element.querySelector('#input-'+question_order[0]).focus();
    display_element.querySelector('#input-'+question_order[1]).focus();
    document.querySelector('form').addEventListener('submit', function(event) {
      event.preventDefault();
      // measure response time
      var endTime = performance.now();
      var response_time = endTime - startTime;

      // create object to hold responses
      var question_data = {};
      

      for(var i=0; i<trial.questions.length; i++){

        if(trial.questions[i].question_type=='multichoice'){

          var match = display_element.querySelector('#jspsych-wjs-survey-all-types-'+i);
          var id = "Q" + i;
          if(match.querySelector("input[type=radio]:checked") !== null){
            var val = match.querySelector("input[type=radio]:checked").value;
          } else {
            var val = "";
          }
          
          var name = match.attributes['data-name'].value;
          if(name == ''){
            name = id;
          }
          var obje = {};
          obje[name] = val;
          Object.assign(question_data, obje);

        }else{

          var id = "Q" + i;
          var q_element = document.querySelector('#jspsych-wjs-survey-all-types-'+i).querySelector('textarea, input'); 

          var val = q_element.value;
          var name = q_element.attributes['data-name'].value;
          if(name == ''){
            name = id;
          }        
          var obje = {};
          obje[name] = val;
          Object.assign(question_data, obje);

        }

      }
    
      // save data
      var trial_data = {
        "rt": response_time,
        "responses": JSON.stringify(question_data),
        "question_order": JSON.stringify(question_order)
      };
      display_element.innerHTML = '';

      // next trial
      jsPsych.finishTrial(trial_data);
    });

    var startTime = performance.now();
    
    // Hiding the gender specify box
    $('#jspsych-wjs-survey-all-types-3').hide();
    $('#jspsych-wjs-survey-all-types-option-2-0').attr('onclick','hideGenderSpecify()');
    $('#jspsych-wjs-survey-all-types-option-2-1').attr('onclick','hideGenderSpecify()');
    $('#jspsych-wjs-survey-all-types-option-2-2').attr('onclick','showGenderSpecify()');
    $('#jspsych-wjs-survey-all-types-option-2-3').attr('onclick','hideGenderSpecify()');
    showGenderSpecify = function(){
      $('#jspsych-wjs-survey-all-types-3').show();
    };
    hideGenderSpecify = function(){
      $('#jspsych-wjs-survey-all-types-3').hide();
    };
    
  };
  return plugin;
 
})();
