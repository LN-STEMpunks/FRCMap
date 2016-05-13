angular.module('starter.controllers', [])

  .controller('DashCtrl', function ($scope, $window, $interval, frcapiService) {
    var search;

    $scope.eventPins = [];
    $scope.teamPins = [];

    $scope.year = 2016;
    $scope.events = [];
    $scope.loadCompleted = false;


    $scope.instructions = {
      "def": "Click an event on the map to see participating teams",

      "def_team": "Participating team's icons are colored according to the age of the team\n" +
      "Greener teams are newer, while bluer teams are older\n" +
      "Click anywhere off of the event to hide teams and return to all events",

      "wait": "Loading data...",

      "loading_event": "Loading data...",
    };

    $scope.current_instruction = $scope.instructions.wait;


    var debouncedFitMapToEvents = ionic.debounce(bestFitMapToEvents, 500);
    function searchModuleLoaded() {

      search = new Microsoft.Maps.Search.SearchManager($scope.map);

      frcapiService.getEvents($scope.year).then(eventDataLoaded);
    }

    function getColor(rookie_year) {
      /*
      Generates a color based on how long a team has existed. Very green means a very new team (at time of event), and very blue means older team
      */
      var r, g, b;
      r = 0;
      b = Math.floor(180 * ((($scope.year - rookie_year)) / ($scope.year - 1992)));
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

          debouncedFitMapToEvents();
        }
      }

      response.data.map(function (event) {
        // for (var idx = 0; idx < response.data.length; idx++) {
        // var event = response.data[idx];
        // var locationString = event.venue_address || event.location;
        var locationString = event.location;
        event.locationString = locationString; // hang on to this for later
        event.teamPins = []; // we'll store each event's team pins for convenience
        if (locationString != null && event.alliances && event.alliances.length) {

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

        var debouncedFitMapToTeams = ionic.debounce(function () { bestFitMapToTeams(event) }, 500);

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
      $interval(function () { $scope.map.setView(options); }, 500);
      //$scope.map.setView(options);
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
        credentials: 'Atuv3Tf8qFuEf69Mneec0RtxJuLOkzywh9ECo3FJUZMIxr0ykJfWxHK5ErEFTI-X'
      });


      $scope.map = map;
      Microsoft.Maps.loadModule('Microsoft.Maps.Search', { callback: searchModuleLoaded });


      Microsoft.Maps.Events.addHandler(map, 'click', function (something) {
        // reset the map to original event pins
        $scope.teamPins.map(function (teamPin) { teamPin.setOptions({ visible: false }) });
        $scope.eventPins.map(function (eventPin) { eventPin.setOptions({ visible: true }) });
        $scope.current_instruction = $scope.instructions.def;
      });



    };

    ionic.Platform.ready(initialize);

    //   $interval(initialize, 2000);

  })

  .controller('ChatsCtrl', function ($scope, Chats) {
    // With the new view caching in Ionic, Controllers are only called
    // when they are recreated or on app start, instead of every page change.
    // To listen for when this page is active (for example, to refresh data),
    // listen for the $ionicView.enter event:
    //
    //$scope.$on('$ionicView.enter', function(e) {
    //});

    $scope.chats = Chats.all();
    $scope.remove = function (chat) {
      Chats.remove(chat);
    };
  })

  .controller('ChatDetailCtrl', function ($scope, $stateParams, Chats) {
    $scope.chat = Chats.get($stateParams.chatId);
  })

  .controller('AccountCtrl', function ($scope) {
    $scope.settings = {
      enableFriends: true
    };
  });
