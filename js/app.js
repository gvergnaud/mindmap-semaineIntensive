'use strict';
var app = {

	routeParams: {},

	proposedWord : false,

	activeWord : false,

	filters : {
		age: false,
		sexe: false
	},

	event: {},

	init: function(){

		app.getRouteParams();

		model.initFirebase();

		model.initUser();

		model.getDico();

		UI.init();

		app.createCustomEvents();

		app.watchData();
		
		//lorsque le graph principale a été crée
		document.addEventListener('graphready', app.onGraphReady, false);

		// lorsque les données sont mises à jour
		document.addEventListener('dataupdate', app.onDataUpdate, false);

		//lorsque l'utilisateur ajoute un mot
		document.addEventListener('usercontribution', app.onUserContribution, false);
		
		// Fermeture de la fenetre droite au clic sur la croix
		document.querySelector("#nodeData .close").addEventListener("click", app.blurWord, false);

		//applique l'evenement addContribution à tous les elements ayant la class
		[].forEach.call(document.querySelectorAll('.addContribution'), function (element) {
			element.addEventListener('keyup', app.addContribution, false);
		});

		// lorsque l'utilisateur tape un caractère dans l'espace recherche
		document.querySelector('#searchInput').addEventListener('keyup', app.searchNode, false);

		// lorsque l'utilisateur tape un caractère dans l'espace recherche
		document.querySelector('div.filters button.resetFilters').addEventListener('click', app.resetFilters, false);
	
		/* Gestion des fenêtres du menu */
        document.getElementById('searchBox').addEventListener("click", function(){
        	UI.menu.searchBoxView();
        	UI.menu.addClickStyle(this);
        	app.blurWord();
        }, false);

        document.getElementById('addWordBox').addEventListener("click", function(){
        	UI.menu.addWordBoxView();
        	UI.menu.addClickStyle(this);
        	app.blurWord();
        }, false);

        document.getElementById('filterBox').addEventListener("click", function(){
        	UI.menu.filterWordBoxView();
        	UI.menu.addClickStyle(this);
        	app.blurWord();
        }, false);

        /* Gestion du footer */
        document.getElementById('aproposButton').addEventListener("click", function() {
        	UI.about.openOverlay();
        }, false);

        document.getElementById('aproposOverlay').addEventListener("click", function() {
        	UI.about.closeOverlay();
        }, false);

        // Overlay d'unfo utilisateur
        document.querySelector('#userInfoOverlay .userInfoForm').addEventListener('submit', app.onUserInfoSubmit, false);
		
		// Gestion du drag du zoom
		var draggie = new Draggabilly( document.querySelector('#cursor'), {
		  axis: 'y',
		  containment: '#zoomBar'
		});
		
		
		draggie.on( 'dragMove', function(instance, event, pointer){
			var zoombarHeight = document.getElementById("zoom").offsetHeight;
			if(instance.position.y < 0)
				instance.position.y = 0;
				
			app.scale =  - (((Math.floor(instance.position.y) * 100 / (zoombarHeight - 15) + ((100 * 7.5) / zoombarHeight) - 100) 
				* (UI.d3.zoomMax - UI.d3.zoomMin) / 100 + UI.d3.zoomMin)) + 0.56;
				
			UI.d3.defineZoom(app.scale);
		});
		
		draggie.on("dragEnd", function(){
			UI.d3.svg.call(d3.behavior.zoom().scale(app.scale).translate(UI.d3.translate).scaleExtent([UI.d3.zoomMin, UI.d3.zoomMax]).on("zoom", function(){
				UI.d3.redrawGraph();
				UI.d3.defineCursor();
			}));
		});
	},

	getRouteParams: function(){
		var hashtab = window.location.hash.split('/');
		app.routeParams.word = hashtab[1];
	},

	createCustomEvents: function(){
		// CrÃ©e l'evenement
		app.event.graphReady = document.createEvent('Event');
		app.event.graphReady.initEvent('graphready', true, true);

		app.event.dataUpdate = document.createEvent('Event');
		app.event.dataUpdate.initEvent('dataupdate', true, true);

		app.event.userContribution = document.createEvent('Event');
		app.event.userContribution.initEvent('usercontribution', true, true);

		app.event.userInfoSubmit = document.createEvent('Event');
		app.event.userInfoSubmit.initEvent('userinfosubmit', true, true);
	},

	onGraphReady: function (e) {

		app.graphCreated = true;

		app.proposeRandomWord();

		UI.d3.svg.call(d3.behavior.zoom().scaleExtent([UI.d3.zoomMin, UI.d3.zoomMax]).on("zoom", function(){
			UI.d3.redrawGraph();
			UI.d3.defineCursor();
		}));

		//si un mot est passé en parametre, on le focus
		if(app.routeParams.word){
			setTimeout(function(){
				app.focusWord( decodeURI(app.routeParams.word) );
			}, 1500);
		}

		//remove l'event listener
		e.target.removeEventListener(e.type);
	},

	onDataUpdate: function(){

		//on affiche les données globales
		UI.printGlobalData(model.words.nodes.length,  model.words.links.length, model.words.contributors);
		
		//si le panneau est ouvert, et qu'il y a un mot actif, on update les données
		if(app.activeWord){
			app.getNodeData(model.getNodeFromWord(app.activeWord), function(nodeData){
				UI.nodeData.printData(nodeData);
			});
		}

		//au click sur un node, on ouvre le panneau droit et on recupérer toutes les données de ce node
		UI.d3.svg.selectAll(".nodes>g>circle").on("mouseup", 	function(node){
			if(d3.event.defaultPrevented == false){
				UI.d3.selectNode(d3.select(this.parentNode));
				app.focusWord(node.name);
			}
		});
		
		// On désactive le double click sur les noeuds
		UI.d3.svg.selectAll(".nodes>g>circle").on("dblclick", 	function(node){
			d3.event.stopPropagation();
		});
	},

	onUserContribution: function (e) {
		setTimeout(function(){
			app.focusWord(app.lastUserContribution);
		}, 1500);

		app.proposeRandomWord();
		if(UI.menu.opened){
			UI.menu.closeModal();
		}

		UI.removeAllNotifications();
	},

	onUserInfoSubmit: function(e){
		e.preventDefault();

		var radioMale = document.querySelector('#userInfoOverlay .userSexe.male'),
			radioFemale = document.querySelector('#userInfoOverlay .userSexe.female'),
			selectAge = document.querySelector('#userInfoOverlay .userAge'),
			sexe,
			age;

		if(radioMale.checked || radioFemale.checked){
			if(radioMale.checked){
							
				sexe = 'male';

			}else if(radioFemale.checked){
				
				sexe = 'female';
			}

			age = selectAge.options[selectAge.selectedIndex].value;

			model.updateUserInfos(sexe, age);

			UI.userInfo.closeOverlay();

			document.dispatchEvent(app.event.userInfoSubmit);
		}else{
			
			UI.notification(document.querySelector('#userInfoOverlay p.error'), 'Veillez spécifier votre sexe');
		}

	},

	watchData: function(){
		model.watchData(function(words){
			//CrÃ©e le graph avec D3.js
			if(app.filters.sexe || app.filters.age){

				model.applyFilters(words, app.filters, function(filteredWords){
					
					if(!app.graphCreated){ //si le graph n'est pas crÃ©Ã© on le crÃ©e
						UI.d3.createGraph( filteredWords );
						app.graphCreated = true;

					}else{ //si il est crÃ©Ã© on update
						UI.d3.updateGraph( filteredWords );
					}
				});

			}else{
				if(!app.graphCreated){ //si le graph n'est pas crÃ©Ã© on le crÃ©e
					UI.d3.createGraph( words );
					app.graphCreated = true;

				}else{ //si il est crÃ©Ã© on update
					UI.d3.updateGraph( words );
				}
			}

			document.dispatchEvent(app.event.dataUpdate);
		});
	},


	reloadData: function(){
		model.getDataOnce(function(words){
			if(app.filters.sexe || app.filters.age){

				model.applyFilters(words, app.filters, function(filteredWords){
							
					UI.d3.createGraph( filteredWords );

					//redraw pour eviter les problèmes de zoom
					UI.d3.svg.call(d3.behavior.zoom().scaleExtent([UI.d3.zoomMin, UI.d3.zoomMax]).on("zoom", function(){
						UI.d3.redrawGraph();
						UI.d3.defineCursor();
					}));
				});

			}else{
				UI.d3.createGraph( words );
				
				//redraw pour eviter les problèmes de zoom
				UI.d3.svg.call(d3.behavior.zoom().scaleExtent([UI.d3.zoomMin, UI.d3.zoomMax]).on("zoom", function(){
					UI.d3.redrawGraph();
					UI.d3.defineCursor();
				}));
			}

			document.dispatchEvent(app.event.dataUpdate);
		});
	},

	getNodeData: function(node, callback){
		var nodeData = {};

		nodeData.name = node.name;

		//nombre de connexions
		nodeData.nbLinks = node.nbLinks;
		
		//nombre d'apparition du mot
		nodeData.occurrence = model.getNodeOccurrence(node);

		//les mots les plus associés
		nodeData.mostAssociatedWords = model.getMostAssociatedWords(node);

		//apparition par sexe
		nodeData.sexeOccurrence = model.getSexeOccurrence(node);

		//apparition par age
		nodeData.ageOccurrence = model.getAgeOccurrence(node);

		if(callback){
			callback.call(this, nodeData);
		}
	},

	proposeRandomWord: function(){
		//rÃ©cupÃ¨re un mot au hasard pour faire contribuer l'utilisateur
		app.proposedWord = model.getRandomWord();

		UI.printWord(app.proposedWord);
	},


	//User interaction
	focusWord: function(word){
		UI.d3.searchNode(word);

		var selectedNode = model.getNodeFromWord(word);

		app.getNodeData(selectedNode, function(nodeData){
			UI.nodeData.openSection();
			UI.nodeData.printData(nodeData);
			app.activeWord = nodeData.name;
		});

		UI.menu.closeModal();

		history.pushState({}, word, '#/' + encodeURI(word));
	},

	blurWord: function(){
		UI.nodeData.closeSection();
		UI.d3.highlightOff();
		app.activeWord = false;
		
		history.pushState({}, 'Home', window.location.href.split('#')[0]);
	},

	addContribution: function(e){
		if(e.keyCode == 13){

			if(this.value){

				var contribution = this.value.toLowerCase();
				var proposedWord;

				if(model.isAFrenchWord(contribution)){

					// si la contribution vien de la fenetre nodeData
					if(e.target.getAttribute('data-activeWord') === 'activeWord'){
						proposedWord = app.activeWord;
					}else{
						proposedWord = app.proposedWord;
					}

					// si les infos d'utilisateur sont remplies
					if(!(model.user.sexe === 'unknown') && !(model.user.age === 'unknown')){
										
						model.addContribution(contribution, proposedWord, 
							function(){ //success
								app.lastUserContribution = contribution;
								document.dispatchEvent(app.event.userContribution);
							},
							function(error){
								// si la contribution vien de la fenetre nodeData
								if(e.target.getAttribute('data-activeWord') === 'activeWord'){
									UI.notification(document.querySelector('#nodeData .error'), error);
								}else{
									UI.notification(document.querySelector('.addWordBox .error'), error);
								}
							}
						);

					}else{

						UI.userInfo.openOverlay();
						UI.menu.closeModal();

						document.addEventListener('userinfosubmit', function(e){
							
							model.addContribution(contribution, proposedWord, 
								function(){ //success
									app.lastUserContribution = contribution;
									document.dispatchEvent(app.event.userContribution);
								},
								function(error){
									// si la contribution vien de la fenetre nodeData
									if(e.target.getAttribute('data-activeWord') === 'activeWord'){
										UI.notification(document.querySelector('#nodeData .error'), error);
									}else{
										UI.notification(document.querySelector('.addWordBox .error'), error);
									}
								}
							);

							//remove l'event listener
							e.target.removeEventListener(e.type);
						});

					}

					this.value = '';

				}else{
					if(e.target.getAttribute('data-activeWord') === 'activeWord'){
						UI.notification(document.querySelector('#nodeData .error'), 'le mot n\'est pas français');
					}else{
						UI.notification(document.querySelector('.addWordBox .error'), 'le mot n\'est pas français');
					}
				}
				
			}
		}
	},

	addUnlinkedWord: function(word){
		model.addUnlinkedNode(word, function(){
			app.lastUserContribution = word.toLowerCase();
			document.dispatchEvent(app.event.userContribution);
		});
	},

	addFilter: function(e, filter, value){

		if(!e.target.classList.contains('active')){
			UI.menu.addActiveFilter(e.target);
			app.filters[filter] = value;

		}else{
			UI.menu.removeActiveFilter(e.target);
			app.filters[filter] = false;
		}

		app.reloadData();		
	},

	resetFilters: function(){
		
		app.filters.sexe = false;
		app.filters.age = false;
		
		UI.menu.removeAllActiveFilter();
		
		app.reloadData();		
		
	},

	searchNode: function(e){
		
		var value = this.value;

		//auto completion avec les mots qui matches avec la recherche
		if(value){
			var matches = model.words.nodes.filter(function (node) {
				return	node.name.substring(0, value.length) === value;
			});
		}else{
			UI.removeAllNotifications();
		}

		var list = document.getElementById('searchAutoComplete');

		list.innerHTML = '';

		if(matches){
			matches.forEach(function(match){
				var option = document.createElement('p');
				option.innerHTML = match.name;
				list.appendChild(option);
				option.addEventListener('click', function(){
					app.focusWord(match.name);
				},false);
			});
		}

		//envoi de la recherche
		if(e.keyCode === 13){
			//si il y a une valeur
			if(value){
				var node = model.getNodeFromWord(value);

				if(node){

					app.focusWord(value);
					this.value = '';

				}else{
					
					if(model.isAFrenchWord(value)){

						var notifElement = document.querySelector('.searchBox p.error');

						UI.notification(
							notifElement,
							'Le mot que vous recherchez n\'est pas dans la carte. voulez vous le rajouter ?',
							function(){ // lorsque l'utilisateur check

								//lorsque son age et son sexe sont bien renseignés
								if(!(model.user.sexe === 'unknown') && !(model.user.age === 'unknown')){
									
									app.addUnlinkedWord(value);

								}else{

									UI.userInfo.openOverlay();
									UI.menu.closeModal();

									document.addEventListener('userinfosubmit', function(e){
										app.addUnlinkedWord(value);
										//remove l'event listener
										e.target.removeEventListener(e.type);
									});

								}
								
							},
							function(){ // lorsque l'utilisateur cancel
								e.target.value = '';
								e.target.focus();
							}
						);

					}else{

						UI.notification(
							document.querySelector('.searchBox p.error'),
							'Le mot que vous avez tapé n\'est pas français'
						);
					}
				}
			}

		}
	}
};

app.init();