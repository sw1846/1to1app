/* ===== 1to1app U build required JS (2025-09-25U5) - upsertJsonInFolder実装版 =====
   - FedCM 有効 / gapiとGIS 自動ローダー
   - 二重初期化/同時要求ガード
   - Drive helpers（ensureFolderStructureByName 等）
   - ☆ 成否イベント発火：document へ 'gis:token' / 'gis:error'
   - [CLAUDE FIX ALL-IN-ONE][upsert] upsertJsonInFolder実装
   - [CLAUDE FIX ALL-IN-ONE][avatar] resolveAttachmentUrl実装
*/
(function(global){
  'use strict';
  var STATE = {
    gapiReady: false,
    gisReady: false,
    tokenInFlight: false,
    tokenClient: null,
    progress: function(){},
    gisScriptRequested: false,
    gapiScriptRequested: false,
    currentToken: null,
    currentFolder: null
  };

  function log(){ try{ console.log.apply(console, ['[data]'].concat([].slice.call(arguments))); }catch(e){} }
  function setStatus(t){ try{ var el=document.getElementById('statusText'); if(el) el.textContent = t; }catch(e){} }
  function sanitizeScopes(s){
    s = (s || '').replace(/\u3000/g,' ').replace(/\s+/g,' ').trim();
    return s || 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly';
  }
  function hasScope(needle){
    try{
      var scopes = (global.APP_CONFIG && APP_CONFIG.SCOPES) || '';
      scopes = sanitizeScopes(scopes);
      return scopes.split(' ').indexOf(needle) >= 0;
    }catch(e){ return false; }
  }
  function btns(){ return Array.prototype.slice.call(document.querySelectorAll('#googleSignInBtn, [data-role="google-signin"], button[onclick*="handleAuthClick"]')); }
  function setBtnsDisabled(v){ try{ btns().forEach(function(b){ b.disabled=!!v; b.dataset.busy=v?'1':''; }); }catch(e){} }
  function showSignin(){ try{ btns().forEach(function(b){ b.style.display = 'inline-block'; }); }catch(e){} }
  function hideSignin(){ try{ btns().forEach(function(b){ b.style.display = 'none'; }); }catch(e){} }
  function showAuthMessage(msg){ try{ setStatus(msg || 'Googleでサインインしてください'); }catch(e){} }

  // === GAPI/GIS 自動ローダー ===
  function ensureGapiScript(){
    return new Promise(function(resolve, reject){
      if(STATE.gapiScriptRequested){
        var check = function(){
          if(typeof gapi !== 'undefined' && gapi.load){
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        check();
        return;
      }
      STATE.gapiScriptRequested = true;
      
      var script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = function(){
        log('gapi スクリプト読込完了');
        resolve();
      };
      script.onerror = function(){
        reject(new Error('gapi script load failed'));
      };
      document.head.appendChild(script);
    });
  }

  function ensureGisScript(){
    return new Promise(function(resolve, reject){
      if(STATE.gisScriptRequested){
        var check = function(){
          if(typeof google !== 'undefined' && google.accounts){
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        check();
        return;
      }
      STATE.gisScriptRequested = true;
      
      var script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = function(){
        log('GIS スクリプト読込完了');
        resolve();
      };
      script.onerror = function(){
        reject(new Error('GIS script load failed'));
      };
      document.head.appendChild(script);
    });
  }

  function initializeGoogleAPI(){
    return new Promise(function(resolve, reject){
      if(STATE.gapiReady && STATE.gisReady){
        resolve();
        return;
      }

      Promise.all([ensureGapiScript(), ensureGisScript()]).then(function(){
        return new Promise(function(gapiResolve, gapiReject){
          gapi.load('client', function(){
            gapi.client.init({
              apiKey: global.APP_CONFIG ? APP_CONFIG.API_KEY : '',
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
            }).then(function(){
              STATE.gapiReady = true;
              log('Google API初期化完了');
              gapiResolve();
            }).catch(gapiReject);
          });
        });
      }).then(function(){
        STATE.tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: global.APP_CONFIG ? APP_CONFIG.CLIENT_ID : '',
          scope: sanitizeScopes((global.APP_CONFIG && APP_CONFIG.SCOPES) || ''),
          callback: handleTokenResponse
        });
        STATE.gisReady = true;
        log('GIS 初期化完了');
        resolve();
      }).catch(reject);
    });
  }

  function handleTokenResponse(response){
    try{
      if(response && response.access_token){
        STATE.currentToken = response.access_token;
        log('token resp', response);
        gapi.client.setToken({access_token: response.access_token});
        
        STATE.tokenInFlight = false;
        setBtnsDisabled(false);
        hideSignin();
        setStatus('認証完了');
        
        document.dispatchEvent(new CustomEvent('gis:token', {detail: response}));
      } else {
        throw new Error('token response invalid');
      }
    }catch(e){
      log('token error:', e);
      STATE.tokenInFlight = false;
      setBtnsDisabled(false);
      showSignin();
      showAuthMessage('認証に失敗しました');
      document.dispatchEvent(new CustomEvent('gis:error', {detail: e}));
    }
  }

  function requestToken(){
    if(STATE.tokenInFlight || !STATE.tokenClient) return;
    
    STATE.tokenInFlight = true;
    setBtnsDisabled(true);
    setStatus('認証中...');
    
    try{
      STATE.tokenClient.requestAccessToken();
    }catch(e){
      handleTokenResponse(null);
    }
  }

  function revokeToken(){
    try{
      if(STATE.currentToken){
        google.accounts.oauth2.revoke(STATE.currentToken);
        STATE.currentToken = null;
      }
      gapi.client.setToken(null);
      showSignin();
      showAuthMessage();
    }catch(e){
      log('revoke error:', e);
    }
  }

  // === Google Drive 操作関数 ===
  
  function createFolder(name, parentId){
    var metadata = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder'
    };
    if(parentId) metadata.parents = [parentId];
    
    return gapi.client.drive.files.create({
      resource: metadata,
      fields: 'id, name'
    }).then(function(response){
      return response.result;
    });
  }

  function findFiles(query){
    return gapi.client.drive.files.list({
      q: query,
      fields: 'files(id, name, mimeType, size, modifiedTime, webContentLink, thumbnailLink)',
      orderBy: 'name'
    }).then(function(response){
      return response.result.files || [];
    });
  }

  function ensureFolderStructureByName(rootFolderName){
    return new Promise(function(resolve, reject){
      try{
        log('resolving migrated structure from folder: ' + rootFolderName);
        
        findFiles("name='" + rootFolderName + "' and mimeType='application/vnd.google-apps.folder'").then(function(folders){
          if(folders.length === 0){
            reject(new Error('フォルダが見つかりません: ' + rootFolderName));
            return;
          }
          
          var rootFolder = folders[0];
          STATE.currentFolder = rootFolder.id;
          
          return Promise.all([
            findFiles("name='index' and mimeType='application/vnd.google-apps.folder' and '" + rootFolder.id + "' in parents"),
            findFiles("name='contacts' and mimeType='application/vnd.google-apps.folder' and '" + rootFolder.id + "' in parents"),
            findFiles("name='meetings' and mimeType='application/vnd.google-apps.folder' and '" + rootFolder.id + "' in parents"),
            findFiles("name='attachments' and mimeType='application/vnd.google-apps.folder' and '" + rootFolder.id + "' in parents")
          ]).then(function(results){
            var structure = {
              root: rootFolder.id,
              index: results[0][0] ? results[0][0].id : null,
              contacts: results[1][0] ? results[1][0].id : null,
              meetings: results[2][0] ? results[2][0].id : null,
              attachments: results[3][0] ? results[3][0].id : null
            };
            
            log('resolved structure:', structure);
            resolve(structure);
          });
        });
      }catch(e){
        reject(e);
      }
    });
  }

  function loadJsonFromFolder(folderId, filename){
    return findFiles("name='" + filename + "' and '" + folderId + "' in parents").then(function(files){
      if(files.length === 0){
        return null;
      }
      
      return gapi.client.drive.files.get({
        fileId: files[0].id,
        alt: 'media'
      }).then(function(response){
        try{
          return JSON.parse(response.body);
        }catch(e){
          log('JSON parse error for ' + filename + ':', e);
          return null;
        }
      });
    });
  }

  // [CLAUDE FIX ALL-IN-ONE][upsert] upsertJsonInFolder実装
  function upsertJsonInFolder(folderId, filename, data, options){
    return new Promise(function(resolve, reject){
      try{
        var jsonData = JSON.stringify(data, null, 2);
        var bytes = new Blob([jsonData]).size;
        
        // 既存ファイルを検索
        findFiles("name='" + filename + "' and '" + folderId + "' in parents").then(function(files){
          if(files.length > 0){
            // 更新
            var fileId = files[0].id;
            gapi.client.request({
              path: 'https://www.googleapis.com/upload/drive/v3/files/' + fileId,
              method: 'PATCH',
              params: {
                uploadType: 'media'
              },
              headers: {
                'Content-Type': 'application/json'
              },
              body: jsonData
            }).then(function(response){
              log('[fix][upsert] ' + filename + ' updated (id=' + fileId + ', bytes=' + bytes + ')');
              resolve(response.result);
            }).catch(function(e){
              log('[warn][upsert] ' + filename + ' failed: ' + e);
              reject(e);
            });
          } else {
            // 新規作成
            var metadata = {
              name: filename,
              parents: [folderId],
              mimeType: 'application/json'
            };
            
            var form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
            form.append('file', new Blob([jsonData], {type: 'application/json'}));
            
            fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
              method: 'POST',
              headers: {
                Authorization: 'Bearer ' + STATE.currentToken
              },
              body: form
            }).then(function(response){
              return response.json();
            }).then(function(result){
              log('[fix][upsert] ' + filename + ' created (id=' + result.id + ', bytes=' + bytes + ')');
              resolve(result);
            }).catch(function(e){
              log('[warn][upsert] ' + filename + ' failed: ' + e);
              reject(e);
            });
          }
        }).catch(reject);
      }catch(e){
        log('[warn][upsert] ' + filename + ' failed: ' + e);
        reject(e);
      }
    });
  }

  // [CLAUDE FIX ALL-IN-ONE][avatar] 添付ファイルURL解決
  function resolveAttachmentUrl(contactId, kind, preference){
    try{
      if(!contactId || !kind) return null;
      
      preference = preference || 'webContentLink';
      
      return new Promise(function(resolve, reject){
        if(!STATE.currentFolder){
          resolve(null);
          return;
        }
        
        ensureFolderStructureByName().then(function(structure){
          if(!structure.attachments){
            resolve(null);
            return;
          }
          
          // attachments/<contactId> フォルダを検索
          return findFiles("name='" + contactId + "' and mimeType='application/vnd.google-apps.folder' and '" + structure.attachments + "' in parents");
        }).then(function(contactFolders){
          if(!contactFolders || contactFolders.length === 0){
            resolve(null);
            return;
          }
          
          var contactAttachmentFolder = contactFolders[0];
          var query = "'" + contactAttachmentFolder.id + "' in parents";
          
          // 種類に応じてファイル名パターンを指定
          if(kind === 'avatar'){
            query += " and (name contains 'avatar' or name contains 'photo' or name contains '顔写真')";
          } else if(kind === 'businessCard'){
            query += " and (name contains 'card' or name contains '名刺' or name contains 'business')";
          }
          
          return findFiles(query);
        }).then(function(files){
          if(!files || files.length === 0){
            resolve(null);
            return;
          }
          
          // 最初の画像ファイルを取得
          var imageFile = files.find(function(file){
            return file.name && file.name.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i);
          });
          
          if(!imageFile){
            resolve(null);
            return;
          }
          
          // URL生成（認証トークン付き）
          var url = null;
          if(preference === 'thumbnailLink' && imageFile.thumbnailLink){
            url = imageFile.thumbnailLink + '&access_token=' + STATE.currentToken;
          } else if(preference === 'webContentLink' && imageFile.webContentLink){
            url = imageFile.webContentLink + '&access_token=' + STATE.currentToken;
          } else {
            // alt=media でダウンロード
            url = 'https://www.googleapis.com/drive/v3/files/' + imageFile.id + '?alt=media&access_token=' + STATE.currentToken;
          }
          
          resolve(url);
        }).catch(function(e){
          log('[warn][avatar] resolveAttachmentUrl error:', e);
          resolve(null);
        });
      });
      
    }catch(e){
      log('[warn][avatar] resolveAttachmentUrl error:', e);
      return Promise.resolve(null);
    }
  }

  function loadDataFromFolder(folderName){
    return new Promise(function(resolve, reject){
      try{
        ensureFolderStructureByName(folderName || '1to1meeting_migrated').then(function(structure){
          log('loading indexes from folder: ' + structure.root);
          
          findFiles("'" + structure.index + "' in parents and name contains 'index.json'").then(function(indexFiles){
            log('found index files:', indexFiles.map(function(f){ return f.name; }));
            
            var loadPromises = indexFiles.map(function(file){
              return gapi.client.drive.files.get({
                fileId: file.id,
                alt: 'media'
              }).then(function(response){
                try{
                  return {
                    name: file.name,
                    data: JSON.parse(response.body)
                  };
                }catch(e){
                  log('parse error for', file.name, e);
                  return {name: file.name, data: []};
                }
              });
            });
            
            return Promise.all(loadPromises);
          }).then(function(indexResults){
            var contacts = [];
            var meetings = [];
            var metadata = {};
            
            indexResults.forEach(function(result){
              switch(result.name){
                case 'contacts-index.json':
                  contacts = result.data || [];
                  break;
                case 'meetings-index.json':
                  meetings = result.data || [];
                  break;
                case 'metadata.json':
                  metadata = result.data || {};
                  break;
              }
            });
            
            log('loaded indexes - contacts: ' + contacts.length + ' meetings: ' + meetings.length);
            
            return Promise.all([
              loadDetailedContacts(structure.contacts, contacts),
              loadDetailedMeetings(structure.meetings, meetings)
            ]).then(function(detailResults){
              resolve({
                contacts: detailResults[0],
                meetings: detailResults[1],
                metadata: metadata,
                structure: structure
              });
            });
          });
        }).catch(reject);
      }catch(e){
        reject(e);
      }
    });
  }

  function loadDetailedContacts(contactsFolderId, contactsIndex){
    if(!contactsIndex || !Array.isArray(contactsIndex)){
      return Promise.resolve([]);
    }
    
    var loadPromises = contactsIndex.map(function(contact){
      if(!contact.id) return Promise.resolve(contact);
      
      return loadJsonFromFolder(contactsFolderId, contact.id + '.json').then(function(detailData){
        if(detailData){
          return Object.assign({}, contact, detailData);
        }
        return contact;
      }).catch(function(e){
        log('failed to load contact detail:', contact.id, e);
        return contact;
      });
    });
    
    return Promise.all(loadPromises);
  }

  function loadDetailedMeetings(meetingsFolderId, meetingsIndex){
    if(!meetingsIndex || !Array.isArray(meetingsIndex)){
      return Promise.resolve([]);
    }
    
    var loadPromises = meetingsIndex.map(function(meeting){
      if(!meeting.id) return Promise.resolve(meeting);
      
      return loadJsonFromFolder(meetingsFolderId, meeting.id + '.json').then(function(detailData){
        if(detailData){
          return Object.assign({}, meeting, detailData);
        }
        return meeting;
      }).catch(function(e){
        log('failed to load meeting detail:', meeting.id, e);
        return meeting;
      });
    });
    
    return Promise.all(loadPromises);
  }

  function saveContactToFolder(contact){
    return new Promise(function(resolve, reject){
      try{
        if(!STATE.currentFolder || !contact.id){
          reject(new Error('フォルダまたは連絡先IDが不正です'));
          return;
        }
        
        ensureFolderStructureByName().then(function(structure){
          return upsertJsonInFolder(structure.contacts, contact.id + '.json', contact);
        }).then(function(){
          return updateContactsIndex(contact);
        }).then(function(){
          resolve();
        }).catch(reject);
      }catch(e){
        reject(e);
      }
    });
  }

  function updateContactsIndex(contact){
    return ensureFolderStructureByName().then(function(structure){
      return loadJsonFromFolder(structure.index, 'contacts-index.json').then(function(index){
        if(!index) index = [];
        
        var existingIndex = index.findIndex(function(c){ return c.id === contact.id; });
        var indexEntry = {
          id: contact.id,
          name: contact.name,
          company: contact.company,
          lastModified: new Date().toISOString()
        };
        
        if(existingIndex >= 0){
          index[existingIndex] = indexEntry;
        } else {
          index.push(indexEntry);
        }
        
        return upsertJsonInFolder(structure.index, 'contacts-index.json', index);
      });
    });
  }

  // [CLAUDE FIX ALL-IN-ONE][upsert] rebuildIndexes修正（フォールバック付き）
  function rebuildIndexes(){
    return new Promise(function(resolve, reject){
      try{
        if(!STATE.currentFolder){
          log('[warn][indexes] rebuild failed, no folder set');
          resolve(); // フォールバック：エラーにしない
          return;
        }
        
        ensureFolderStructureByName().then(function(structure){
          return findFiles("'" + structure.contacts + "' in parents and name contains '.json'").then(function(contactFiles){
            var contactsIndex = contactFiles.map(function(file){
              return {
                id: file.name.replace('.json', ''),
                lastModified: file.modifiedTime
              };
            });
            
            return findFiles("'" + structure.meetings + "' in parents and name contains '.json'").then(function(meetingFiles){
              var meetingsIndex = meetingFiles.map(function(file){
                return {
                  id: file.name.replace('.json', ''),
                  lastModified: file.modifiedTime
                };
              });
              
              return Promise.all([
                upsertJsonInFolder(structure.index, 'contacts-index.json', contactsIndex),
                upsertJsonInFolder(structure.index, 'meetings-index.json', meetingsIndex),
                upsertJsonInFolder(structure.index, 'metadata.json', {
                  lastRebuild: new Date().toISOString(),
                  version: '2025-09-25U'
                })
              ]);
            });
          });
        }).then(function(){
          log('indexes rebuilt successfully');
          resolve();
        }).catch(function(e){
          log('[warn][indexes] rebuild failed, fallback used:', e);
          resolve(); // フォールバック：エラーにしない
        });
      }catch(e){
        log('[warn][indexes] rebuild failed, fallback used:', e);
        resolve(); // フォールバック：エラーにしない
      }
    });
  }

  // グローバル関数エクスポート
  global.initializeGoogleAPI = initializeGoogleAPI;
  global.requestToken = requestToken;
  global.revokeToken = revokeToken;
  global.ensureFolderStructureByName = ensureFolderStructureByName;
  global.loadDataFromFolder = loadDataFromFolder;
  global.saveContactToFolder = saveContactToFolder;
  global.upsertJsonInFolder = upsertJsonInFolder;
  global.rebuildIndexes = rebuildIndexes;
  global.loadJsonFromFolder = loadJsonFromFolder;
  global.findFiles = findFiles;
  global.createFolder = createFolder;
  global.resolveAttachmentUrl = resolveAttachmentUrl;

  // 自動初期化
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      initializeGoogleAPI().catch(function(e){
        log('auto init failed:', e);
      });
    });
  } else {
    initializeGoogleAPI().catch(function(e){
      log('auto init failed:', e);
    });
  }

})(window);