nodeache
========

A static-webpage-generator based on node.js using mustaches, markdown and JSON.

* Realtime editing
* Publishing via FTP

Installation
------------

    $ sudo npm install -g nodeache
    
Usage
-----

Building a website:

    $ nodeache folder
    
Rebuilding a website everytime a file or folder has changed:

    $ nodeache dev folder
    
Publishing a website via FTP:

    $ nodeache publish folder
    
Where folder is a *folder* following the structure given under *Folder structure*.

Folder structure
----------------

    folder
    |-  (config.json)
    |-  content
    '-  templates
    
Content
-------

All content is saved in *folder/content*. 

It is possible to save content as markdown with the file-extensions *md* or *markdown* or as JSON with the file-extension *json*. The resulting block will be named after the filename.

**Special cases:**

* Markdown files can be ordered by prepending *XX-* to the filename. (i.e. *01-Home.md*, *02-About.md* etc.) *XX-* will be skipped in the blockname. (i.e. *01-Home.md* will be *Home*)
* Files placed in a subdirectory will be named according to their path. (i.e. *folder/content/pages/01-Home.md* will be *pages.Home* or *pages.0*)

Templating
----------

All templates are saved in *folder/templates*. It is possible to create as much subdirectorys as you want. A template consists of a fully functional website except for the content.

Content can be included via the syntax of [handlebars.js](http://handlebarsjs.com/).

config.json
-----------
