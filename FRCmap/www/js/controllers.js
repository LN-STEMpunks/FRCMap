angular.module('starter.controllers', [])

  .controller('DashCtrl', function ($scope, $window, $interval, frcapiService) {
    var search;
    $scope.yearRange = [];
    for (var yr = new Date().getFullYear(); yr > 1991; yr--) {
      $scope.yearRange.push(yr);
    }

    $scope.eventPins = [];
    $scope.teamPins = [];

    $scope.year = 2016;
    $scope.events = [];
    $scope.loadCompleted = false;


    $scope.instructions = {
      "def": "Click an event on the map to see participating teams",

      "def_team": "Participating team's icons are colored according to the age of the team<br>" +
      "Greener teams are newer, while bluer teams are older <br>" +
      "Click anywhere off of the event to hide teams and return to all events",

      "wait": "Loading data...",

      "loading_event": "Loading data...",
    };

    $scope.current_instruction = $scope.instructions.wait;


    var debouncedFitMapToEvents = ionic.debounce(bestFitMapToEvents, 100);
    function searchModuleLoaded() {

      search = new Microsoft.Maps.Search.SearchManager($scope.map);

      frcapiService.getEvents($scope.year).then(eventDataLoaded);
    }
    $scope.refreshYear = function () {

      $scope.map.entities.clear();
      $scope.eventPins = [];
      $scope.teamPins = [];

      $scope.events = [];
      $scope.loadCompleted = false;
      frcapiService.getEvents($scope.year).then(eventDataLoaded);
    }

    function getColor(rookie_year) {
      /*
      Generates a color based on how long a team has existed. Very green means a very new team (at time of event), and very blue means older team
      */
      var year = $scope.year;
      var r, g, b;
      r = 0;
      b = Math.floor(180 * (((year - rookie_year)) / (year - 1992)));
      g = 180 - b;
      return "rgb(" + r + ", " + g + ", " + b + ")";
    }

    function eventDataLoaded(response) {

      $scope.events = response.data;
      $scope.loadCompleted = true;

      function geoCodeError(geocodeRequest, userData, event) {
        console.log("geocode error for event " + event.key + " " + event.locationString + ", " + geocodeRequest)
      }

      function geoCodeSuccess(geocodeResult, userData, event) {
        if (geocodeResult && geocodeResult.results) {
          var location = geocodeResult.results[0].location;
          //var location = new Location(event.venue_address);
          //console.log("FRC event " + event.key + ", " + event.locationString);

          for (var i = 0; i < $scope.events.length; ++i) {
            var evt = $scope.events[i];
            if (evt.eventLocation) {
              if ((evt.eventLocation.latitude == location.latitude && evt.eventLocation.longitude == location.longitude)) {
                location.latitude += .02;
              }
            }
          }

          var pushpin = new Microsoft.Maps.Pushpin(location,
            {
              // text: event.key,
              text: 'E',
              color: 'red',
              title: event.name + ' ' + event.locationString,
              subTitle: event.start_date,
            });

          // store this so we can easily recall the location from the pin
          pushpin.eventLocation = location;
          event.eventLocation = location;

          // Add a handler to the pushpin drag
          Microsoft.Maps.Events.addHandler(pushpin, 'click', function (something) {

            //hide other pins
            $scope.eventPins.map(function (eventPin) { if (eventPin != pushpin) eventPin.setOptions({ visible: false }) });

            if (event.teams == null) {
              frcapiService.getEventTeams(event.key).then(function (response) {
                event.teams = response.data;
                wireUpEventTeamData(event);
              });
            }
            else {
              wireUpEventTeamData(event);

            }
          });
          $scope.eventPins.push(pushpin);
          $scope.map.entities.push(pushpin);

          // this doesn't really work that well. just leave it alone for now
          //debouncedFitMapToEvents();
        }
      }

      response.data.map(function (event) {
        // for (var idx = 0; idx < response.data.length; idx++) {
        // var event = response.data[idx];
        // var locationString = event.venue_address || event.location;
        var locationString = event.location;
        event.locationString = locationString; // hang on to this for later
        event.teamPins = []; // we'll store each event's team pins for convenience
        //if (locationString != null && event.alliances && event.alliances.length) {
        if (locationString != null) {

          search.geocode({
            where: locationString, count: 1,
            errorCallback: function (geocodeRequest, userData) { geoCodeError(geocodeRequest, userData, event) },
            callback: function (geocodeResult, userData) { geoCodeSuccess(geocodeResult, userData, event) }

          });

        } else {
          console.log("FRC event " + event.key + ", unable to locate");
        }
      });

      $scope.current_instruction = $scope.instructions.def;
    }

    function wireUpEventTeamData(event) {
      if (event.teams && event.teams.length) {
        $scope.current_instruction = $scope.instructions.def_team;

        var debouncedFitMapToTeams = ionic.debounce(function () { bestFitMapToTeams(event) }, 100);

        event.teams.map(function (team) {
          //console.log("event " + event.key + ", team: " + team.key + ", location: " + team.location);

          // only do the geocode once. If we've already assigned teamLocation, we don't have to do it again
          if (team.teamLocation != null && team.pushpinTeam != null) {
            team.pushpinTeam.setOptions({ visible: true });
          }
          else {
            var teamLocationString = team.location;
            if (teamLocationString != null) {
              search.geocode({
                where: teamLocationString, count: 1,
                callback: function (geocodeResultTeam, userDataTeam) {
                  if (geocodeResultTeam && geocodeResultTeam.results) {
                    var locationTeam = geocodeResultTeam.results[0].location;
                    for (var i = 0; i < event.teams.length; ++i) {
                      if (event.teams[i].teamLocation && (event.teams[i].teamLocation.latitude == locationTeam.latitude && event.teams[i].teamLocation.longitude == locationTeam.longitude)) {
                        locationTeam.latitude += .02;
                      }
                    }
                    var pushpinTeam = new Microsoft.Maps.Pushpin(locationTeam,
                      {
                        //text: team.key,
                        text: 'T',
                        color: getColor(team.rookie_year),
                        title: team.nickname + " " + team.key,
                        subTitle: teamLocationString,
                      });
                    // store this so we can easily recall the location from the pin
                    pushpinTeam.teamLocation = locationTeam;
                    team.pushpinTeam = pushpinTeam;
                    team.teamLocation = locationTeam;

                    /*
                    
                    country_name
:
"USA"
key
:
"frc5178"
locality
:
"Farmington"
location
:
"Farmington, Arkansas, USA"
motto
:
"The Nerdiest Bird Gets the Worm"
name
:
"Baldor Electric & Farmington High School"
nickname
:
"The Nerdy Birds"
pushpinTeam
:
t
region
:
"Arkansas"
rookie_year
:
2014
teamLocation
:
t
team_number
:
5178
website
:
"http://www.firstinspires.org/"
                    
                    
                    */

                    var line1 = "<div>";
                    /*if (team.motto) {
                      line1 += "<div>\"" + team.motto + "\" </div>";
                    }*/
                    if (team.key) {
                      line1 += "<div>FRC#" + (team.key).replace("frc", '') + "" + " </div>";
                    }
                    if (team.rookie_year) {
                      line1 += "<div>Rookie Year: " + team.rookie_year + " </div>";
                    }
                    if (team.website) {
                      line1 += "<div><a target='_blank' href=" + team.website + ">Website</a>" + " </div>";
                    }

                    line1 += "<div style='float: right'><a target='_blank' href=http://lnstempunks.azurewebsites.net/FRCapp/#/app/team-detail/" + team.key + "> More Info</a></div>";


                    line1 += "</div>";

                    var infoboxOptions = {
                      visible: false,
                      width: 200,
                      height: 200,
                      showCloseButton: true,
                      zIndex: 0,
                      offset: new Microsoft.Maps.Point(0, 0),
                      showPointer: true,
                      title: team.nickname,
                      description: line1,
                      //description: "<div>hello world <div>nested div</div>",
                      //description: '<div id="infoboxText" style="background-color:White; border-style:solid;border-width:medium; border-color:DarkOrange; min-height:100px;width:240px;"><b id="infoboxTitle" style="position:absolute; top:10px; left:10px; width:220px;">myTitle</b><a id="infoboxDescription" style="position:absolute; top:30px; left:10px; width:220px;">Description</a></div>',
                    };
                    var infobox = new Microsoft.Maps.Infobox(locationTeam, infoboxOptions);
                    $scope.map.entities.push(infobox);
                    //infobox.setHtmlContent('<div id="infoboxText" style="background-color:White; border-style:solid;border-width:medium; border-color:DarkOrange; min-height:100px;width:240px;"><b id="infoboxTitle" style="position:absolute; top:10px; left:10px; width:220px;">myTitle</b><a id="infoboxDescription" style="position:absolute; top:30px; left:10px; width:220px;">Description</a></div>'); 

                    // HACKISH: bing maps v8 seems to not respond to touch events on android chrome
                    // Also popups on mobile are kinda annoying. So for mobile devices, let's just show the team info in the footer div instead of infobox 
                    Microsoft.Maps.Events.addHandler(pushpinTeam, 'click', function showToolTip(e) {
                      $scope.current_instruction = line1;
                      $scope.$apply();
                    });
                    Microsoft.Maps.Events.addHandler(pushpinTeam, 'mouseover', function showToolTip(e) {
                      $scope.current_instruction = line1;
                      $scope.$apply();
                    });
                    if (ionic.Platform.isAndroid() || ionic.Platform.isIOS() || ionic.Platform.isWindowsPhone()) {

                    }
                    else {
                      // for non-mobile devices, we'll also show a popup infobox
                      pushpinClick = Microsoft.Maps.Events.addHandler(pushpinTeam, 'click', displayEventInfo);
                    }

                    // bing maps v7 and v8 work differently, handle either just in case
                    if (infobox.setMap)
                      infobox.setMap($scope.map);
                    else
                      infobox.map = ($scope.map);

                    pushpinTeam.infobox = infobox; //So we can get it from $scope

                    function displayEventInfo() {
                      infobox.setOptions({ visible: true, });
                    }


                    /*var infobox = new Microsoft.Maps.Infobox(locationTeam, { description: 'description', showCloseButton: false, showPointer: false });


                     Microsoft.Maps.Events.addHandler(pushpinTeam , 'mouseover', tooltipPin);

                     Microsoft.Maps.Events.addHandler(pushpinTeam , 'mouseout', tooltipPin2);

                     function tooltipPin(e) {
                        var loc = e.target.getLocation();
                        infobox.setMap($scope.map);
                        infobox.setLocation(loc);
                        infobox.setHtmlContent('<div id="infoboxText" style="background-color:White; border-style:solid; border-width:medium; border-color:DarkOrange; min-height:40px; width: 150px; "><p id="infoboxDescription" style="position: absolute; top: 10px; left: 10px; width: 220px; ">mydescription</p></div>');
                      };

                      function tooltipPin2(e) {
                        infobox.setHtmlContent('<div></div>');
                      };*/

                    // Add a handler to the pushpin drag
                    //Microsoft.Maps.Events.addHandler(pushpinTeam, 'click', function(something){

                    $scope.teamPins.push(pushpinTeam);
                    event.teamPins.push(pushpinTeam);
                    $scope.map.entities.push(pushpinTeam);
                    debouncedFitMapToTeams();
                  }
                }
              });
            } else {
              console.log('unable to get location for team: ', team.key);
            }
          }
        });
      }
      else {

        console.log('No teams found for event: ', event.key);
        alert('No teams found for event: ', event.key);

        $scope.eventPins.map(function (eventPin) { eventPin.setOptions({ visible: true }) });
      }
    }

    function bestFitMapToEvents() {
      // find best fit bounds from the locations
      var allEventLocations = $scope.eventPins.map(function (ep) { return ep.eventLocation });
      var bestFitEvents = new Microsoft.Maps.LocationRect.fromLocations(allEventLocations);
      // var options = $scope.map.getOptions();
      var options = {};
      options.bounds = bestFitEvents;
      $scope.map.setView(options);
    }

    function bestFitMapToTeams(event) {
      // find best fit bounds from the locations
      if (event && event.teamPins) {
        var allTeamLocations = event.teamPins.map(function (tp) { return tp.teamLocation });
      } else {
        var allTeamLocations = $scope.teamPins.map(function (tp) { return tp.teamLocation });
      }
      var bestFitTeams = new Microsoft.Maps.LocationRect.fromLocations(allTeamLocations);
      // var options = $scope.map.getOptions();
      var options = {};
      options.bounds = bestFitTeams;
      $scope.map.setView(options);
    }
    function initialize() {

      var map = new Microsoft.Maps.Map(document.getElementById('myMap'), {
        credentials: 'Atuv3Tf8qFuEf69Mneec0RtxJuLOkzywh9ECo3FJUZMIxr0ykJfWxHK5ErEFTI-X',
        center: new Microsoft.Maps.Location(37, -95),
        zoom: 4,
        mapTypeId: Microsoft.Maps.MapTypeId.road,
      });


      $scope.map = map;
      Microsoft.Maps.loadModule('Microsoft.Maps.Search', { callback: searchModuleLoaded });


      Microsoft.Maps.Events.addHandler(map, 'click', function (e) {
        // reset the map to original event pins
        if (e.targetType == "map") {
          $scope.current_instruction = $scope.instructions.def;
          $scope.teamPins.map(function (teamPin) {
            teamPin.setOptions({ visible: false });
            teamPin.infobox.setOptions({ visible: false });
          });
          $scope.eventPins.map(function (eventPin) { eventPin.setOptions({ visible: true }) });
          $scope.$apply();
        }

      });



    };

    ionic.Platform.ready(initialize);

    //   $interval(initialize, 2000);

  })
  ;
