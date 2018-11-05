// setup / booting / debug
var base_image_url = "resources/images/";
var title = $(document).attr("title");
var skip_startup_process = false;
var booted = false;
var boot_delays = {
	turn_on_screen: 300,
	show_startup_screen: 2500,
	show_loading_screen: 7000,
	show_loading_screen_window: 500,
	show_finder_window: 500
}

// window
var frontmost_window = $(".window#finder");
var in_device = true;
var screen_scales = {
	full_screen: 1,
	in_device: 0.5
}
var screen_scale = screen_scales["in_device"];
var screen_offset;

// dock
var dock_settings = {
	original_size: 62, // px
	adjacent_icons_affected: 2, // how far in either direction should multiplication factor be applied
	initial_scale: 1,
	magnification_factor: 1.5, // initial scale will be multiped by this
	margin_bottom: 15, // px
	icon_bouncing_delay_before_open: 3000 // ms
}

function preload_images(images) {
	$(images).each(function() {
		$("<img src='"+base_image_url+this+"'/>").appendTo("body").css("display", "none");
	});
}

function update_clock() {
	// get current time
	var now = new Date();
	
	// get current time components
	var hours = now.getHours();
	var minutes = now.getMinutes();
	var seconds = now.getSeconds();
	var weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	var day = weekdays[now.getDay()];
	
	// add leading zeros
	if(seconds < 10) { seconds = "0" + seconds; }
	if(minutes < 10) { minutes = "0" + minutes; }
	
	// determine AM/PM
	var am_pm = hours >= 12 ? "PM" : "AM";
	
	// fix hour 12
	hours = hours % 12;
	hours = hours ? hours : 12;
	
	// generate string and update clock element
	var clock_string = day + " " + hours + ":" + minutes + ":" + seconds + " " + am_pm;
	$("#menu-bar #right-contents #clock").html(clock_string);
}

function begin_startup_process() {
	if(skip_startup_process) {
		// if debugging, set all boot delays to 0 and skip to desktop
		Object.keys(boot_delays).forEach(delay => boot_delays[delay] = 0)
	}

	setTimeout(function() {
		$(document).attr("title", title+": Booting...");
		
		// turn on screen and hide boot prompt
		$("#off").hide();
		$("#boot-prompt").hide();
		
		// play boot sound
		$("#boot-sound")[0].play();
	
		setTimeout(function() {
			$("#startup").hide();
			$(document).attr("title", title+": Loading...");
	
			setTimeout(function() {
				$("#loading #loading-window").show();
				
				// fill up progress bar
				$(".progress-bar-fill").css("width", "100%");

				// cycle through each loading messages with a delay between them
				setTimeout(function() {
					$("#loading-message").html("Cleaning menu bar...");
	
					setTimeout(function() {
						$("#loading-message").html("Fishing for icons...");
	
						setTimeout(function() {
							$("#loading-message").html("Is it stuck!?");
						}, 3000);
					}, 1500);
				}, 1000);

				setTimeout(function() {
					$("#loading").hide();
	
					setTimeout(function() {
						$(".window#finder").show();
						$(document).attr("title", title);
					}, boot_delays["show_finder_window"]);
				}, boot_delays["show_loading_screen"]);
			}, boot_delays["show_loading_screen_window"]);
		}, boot_delays["show_startup_screen"]);
	}, boot_delays["turn_on_screen"]);

	// update state variable
	booted = true;
}

function toggle_in_device() {
	// toggle between in device and full screen
	if(in_device) {
		// switch to full screen
		$("body").removeClass("device-showing");
		$("#device").removeClass("showing");
	
		setTimeout(function() {
			$("#screen").removeClass("in-device");
			
			setTimeout(function() {
				$("#device").css("transform", "scale(.8)");
				
				setTimeout(function() {
					set_screen_offset();
				}, 500);
			}, 200);
		}, 500);
		
		// update screen scale to full screen
		screen_scale = screen_scales["full_screen"];
	} else {
		// switch to device
		$("body").addClass("device-showing");
		$("#screen").addClass("in-device");
	
		setTimeout(function() {
			$("#device").addClass("showing").css("transform", "scale(.89)");
			
			setTimeout(function() {
				set_screen_offset();
			}, 500);
		}, 300);
		
		// update screen scale to in device
		screen_scale = screen_scales["in_device"];
	}
	
	// flip state variable
	in_device = !in_device;
}

function correct_for_scaling(event, ui, containment, draggable) {
	// make dragging windows still respect correct containment coordinates even when screen is not full screen
	var change_left = ui.position.left - ui.originalPosition.left;
	var new_left = ui.originalPosition.left + change_left / (screen_scales["in_device"]);

	var change_top = ui.position.top - ui.originalPosition.top;
	var new_top = ui.originalPosition.top + change_top / screen_scales["in_device"];

	if(new_top > ($(containment).height() - $(draggable).height())) {
		ui.position.top = ($(containment).height() - $(draggable).height());
	} else {
		ui.position.top = new_top;
	}

	if(new_left > ($(containment).width() - $(draggable).width())) {
		ui.position.left = ($(containment).width() - $(draggable).width());
	} else {
		ui.position.left = new_left;
	}
}

function show_and_bring_window_id_to_front(this_window_id) {
	// get window element from id
	var this_window = $(".window#"+this_window_id);

	// show and bring to front
	this_window.show();
	bring_window_to_front(this_window);
}

function bring_window_to_front(this_window) {	
	// get the z-index of the frontmost window
	var current_top_z_index = parseInt(frontmost_window.css("z-index"), 10);
	
	// set this window to 1 more than highest z-index, add foreground class, remove background class
	this_window.css("z-index", current_top_z_index+1).addClass("foreground").removeClass("background");
	
	// for all other windows, remove foreground class, add background class
	$(".window").not(this_window).addClass("background").removeClass("foreground");
	
	// set frontmost window to this window
	frontmost_window = this_window;

	// if app available, set menu bar app name and items to frontmost window	
	if(this_window.attr("class").includes("app-unavailable") == false) {
		update_menu_bar(this_window.attr("id"));
	}
}

function update_menu_bar(this_window_id) {
	// make an exception for streak notification to act like finder
	if(this_window_id == "streak-notification") {
		this_window_id = "finder";
	}
	
	// get window element from id
	var this_window = $(".window#"+this_window_id);
	
	// change contents of menu bar
	$("#menu-bar #left-contents .app-name").html(this_window.data("app-name-display"));
	$("#menu-bar #left-contents .app-menu-item-set[data-app-id="+this_window.attr("id")+"]").show();
	$("#menu-bar #left-contents .app-menu-item-set[data-app-id!="+this_window.attr("id")+"]").hide();	
}

function set_screen_offset() {
	// if window is smaller than dock, use dock wrapepr left edge as screen offset, otherwise use left edge of screen
	if(window.innerWidth <= 860) {		
		screen_offset = $("#dock-wrapper").offset().left;
	} else {
		screen_offset = $("#screen").offset().left;
	}
}

function make_windows_draggable() {
	// set draggable settings
	$(".window").css("position", "absolute").draggable({
		containment: "#desktop",
		cancel: ".window-controls",
		start: function(event, ui) {
			// reset original window offset to assist correct_for_scaling()
			ui.position.left = 0;
			ui.position.top = 0;
	
			// bring window to front when starting to be dragged
			bring_window_to_front($(event.target));
	
			// close menu bar dropdown
			$(".menu-bar-icon-wrapper").removeClass("open").parent().removeClass("open");
		},
		drag: function(event, ui) {
			// if in device, correct draggable coordinates for screen scaling
			if(in_device) {
				correct_for_scaling(event, ui, "#desktop", ".window#"+event.target.id);
			}
		}
	}).click(function(e) {
		// unless clicked on window controls, bring window to front
		// (clicking window controls will close window and don't want to bring app to front when closed)
		if(!e.target.className.includes("window-controls")) {
			bring_window_to_front($(this));
		}
	});
	
	// for aqua windows, only allow dragging by title bar
	// brushed windows can be dragged anywhere
	$(".window.aqua").draggable({
		handle: ".title-bar",
	});
	
	// when window controls are clicked, hide that window
	$(".window .window-controls").click(function() {
		$(this).closest(".window").hide();
	});
}

$(document).ready(function() {
	
	// --------- setup ---------
	
	// preload some core images
	preload_images([
		"window-title-bar-corners.png",
		"window-title-bar-fill.png",
		"window-controls-aqua.png",
		"mac-os-x-welcome.jpg",
		"mac-os-x-loading.jpg",
		"button.png",
		"button-blue.png",
		"button-blue-pulse-overlay.png",
		"slider-handle.png",
		"menu-bar-icon-volume.png",
		"menu-bar-repeat.png",
		"menu-bar-selected-repeat.png"
	]);
	
	// set click with current and update every second
	update_clock();
	setInterval("update_clock()", 1000);
	
	// set Finder window as frontmost foreground window
	bring_window_to_front($(".window#finder"));

	// set volume for boot sound
	$("#boot-sound")[0].volume = 0.08;
	
	// after delay for DOM elements to render, hide curtain
	setTimeout(function() {
		$("#curtain").css("opacity", 0);
		set_screen_offset();
	}, 500);
	
	// set slider to default volume value
	$(".slider.volume").on("change mousemove", function() {
		// and update other sliders
		$(".slider.volume").val($(this).val());
	});
	
	// --------- windows ---------
	
	// make all windows draggable
	make_windows_draggable();
	
	// --------- menu bar ---------
	
	// toggle menu dropdown on menu item click
	$(".menu-bar-icon-wrapper.toggle-dropdown").click(function() {
		$(this).toggleClass("open").parent().toggleClass("open");
	});
	
	// when Apple icon is clicked, show Finder window
	$("#menu-bar .apple-logo").click(function() {
		show_and_bring_window_id_to_front("finder");
	});
	
	// --------- dock ---------
	
	// initially set the size of dock icons
	$(".dock-icon").css("width", dock_settings.original_size+"px").css("height", dock_settings.original_size+dock_settings.margin_bottom+"px");
	
	// get each dock icon
	var dock_icon = document.getElementsByClassName("dock-icon");
	
	// when hover or mousemove on dock icon
	$("#dock-icons, .dock-icon").on("mouseover mousemove", function(event) {
		// get the mouse x position, accounting for smaller screen scale when in device
		var mouse_x_position = (event.clientX - screen_offset) / screen_scale;

		for (var this_icon = 0; this_icon < dock_icon.length; this_icon++) {
			// get mouse x position relative to dock
			var mouse_x_position_relative_to_dock = (mouse_x_position - (dock_icon[this_icon].offsetLeft + (dock_settings.original_size/2))) / screen_scale;
			
			// determine how many adjacent icons should be enlarged
			var range_adjacent_icons_affected = (dock_settings.original_size * (dock_settings.adjacent_icons_affected * 2)) / screen_scale;
			
			// based on mouse x position, determine scale of affected icons
			var icon_scale = ((Math.abs(mouse_x_position_relative_to_dock) - range_adjacent_icons_affected) / (0 - range_adjacent_icons_affected)) * ((dock_settings.initial_scale*dock_settings.magnification_factor) - 1) + 1;
			
			// make sure the scale doesn't go smaller than initial scale or bigger than magnification factor
			var icon_scale_capped = Math.min(Math.max(icon_scale, dock_settings.initial_scale), (dock_settings.initial_scale*dock_settings.magnification_factor));
			
			// set the width and height based on the scale
			dock_icon[this_icon].style.width = icon_scale_capped*dock_settings.original_size+"px";
			dock_icon[this_icon].style.height = (icon_scale_capped*dock_settings.original_size)+dock_settings.margin_bottom+"px";  
		}
	}).mouseout(function() {
		// on mouseout, reset all icon sizes to original size
		$(".dock-icon").css("width", dock_settings.original_size+"px").css("height", dock_settings.original_size+dock_settings.margin_bottom+"px");
	});
	
	var last_window_opened;
	
	// on click of a dock icon that is an app but not open
	$(".dock-icon.app").not(".open").not(".opening").click(function() {
		
		// start bouncing icon
		$(this).addClass("opening");
		
		setTimeout(function() {
			// after delay, stop bouncing icon
			$(this).removeClass("opening");
			
			// if this app is openable
			if($(this).hasClass("openable")) {

				// show app window and bring to front
				show_and_bring_window_id_to_front($(this).data("app-id"));
				
				// add open indicator and replace click functionality
				$(this).addClass("open").unbind("click").click(function() {
					// show app window and bring to front
					show_and_bring_window_id_to_front($(this).data("app-id"));
				});
			} else {
				// if an "app unavailable dialog" for this app is not alreday in the DOM 
				if($("#app-unavailable-window-"+$(this).data("app-id")).length == 0) {
			
					// reset window offset
					var window_position_offset_style;
					
					// get last window opened
					last_window_opened = $(".window.app-unavailable").last();
			
					// if there has already been an app unavailable window opened
					if(last_window_opened.length > 0) {
						// set delta in position for new window in px
						var window_position_offset = 25;
						
						// set position of new window based on position data of last window
						var window_position_top = last_window_opened.data("window-position-top") - window_position_offset;
						var window_position_left = last_window_opened.data("window-position-left") - window_position_offset;
						
						// generate offset style string
						window_position_offset_style = ' style="top: calc(50% - '+window_position_top+'px); left: calc(50% - '+window_position_left+'px);"';
					} else {
						// if first window, set position data to center position
						var window_position_top = 145;
						var window_position_left = 200;
					}
			
					// add an "app unavailable dialog" to DOM
					$("#desktop").append('<div class="window aqua app-unavailable" id="app-unavailable-window-'+$(this).data("app-id")+'" data-app-name-id="'+$(this).data("app-id")+'"'+window_position_offset_style+' data-window-position-top="'+window_position_top+'" data-window-position-left="'+window_position_left+'"><div class="title-bar"><div class="window-controls aqua"></div></div><div class="app-unavailable-icon" style="'+$(this).children(".dock-icon-image").attr("style")+'"></div><h1>'+$(this).children("label").html()+' Not Installed</h1><p>Sorry, this app is not installed on this Mac. Please insert the installer CD-ROM and try again.<br><span class="small">If you do nothing, the system will automatically close this window after <span class="seconds-label">3 seconds</span>.</span></p><div class="button blue"><label>OK</label></div><div class="background"></div></div>');				
		
					// because new window has been added to DOM, re-make all windows to be draggable
					make_windows_draggable();
		
					// bring new window to front
					bring_window_to_front($("#app-unavailable-window-"+$(this).data("app-id")));
					
					// update seconds label
					setTimeout(function() {
						$("#app-unavailable-window-"+$(this).data("app-id")+" p .small .seconds-label").html("2 seconds");
			
						setTimeout(function() {
							$("#app-unavailable-window-"+$(this).data("app-id")+" p .small .seconds-label").html("1 second");
				
							setTimeout(function() {
								// remove window from DOM
								$("#app-unavailable-window-"+$(this).data("app-id")).remove();
							}.bind(this), 1000);
						}.bind(this), 1000);
					}.bind(this), 1000);
	
					// bind button click to close window
					$(".window.app-unavailable .button").click(function() {
						$(this).closest(".window.app-unavailable").remove();
					});
				}
			}
		}.bind(this), dock_settings.icon_bouncing_delay_before_open);
	});
	
	// on click of dock icon that is open when booted (basically for Finder)
	$(".dock-icon.app.open").click(function() {
		// show app window and bring to front
		show_and_bring_window_id_to_front($(this).data("app-id"));
	});
	
	// --------- app-specific ---------
	
	// buttons in System Preferences
	$(".window#system-preferences #toggle-device").click(toggle_in_device);
	
	// button in welcome screen
	$(".window#finder .button").click(toggle_in_device);
	
}).keyup(function(keyboard) {
	// mostly for debug, if "Q" key is pressed on keyboard, toggle device state
	var q_key_code = 81;
	if(keyboard.keyCode == q_key_code) {
		toggle_in_device();
	}
}).on("click mousedown touchstart", function(event) {
	// if a click is not on this menu bar dropdown, hide the dropdown
	if($(event.target).closest("#menu-bar-icon-dropdown-pair").length == 0) {
		$(".menu-bar-icon-wrapper").removeClass("open").parent().removeClass("open");
	}

	// not booted, begin startup process
	if(!booted) {
		begin_startup_process();
	}
});

// update screen offset when window is resized
$(window).resize(function() {
	set_screen_offset();
});