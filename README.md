nodeache
========

A static-webpage-generator based on node.js using mustaches, markdown and JSON.

Installation
------------

    sudo npm install -g nodeache
    
Usage
-----

Building a website:

    nodeache folder
    
Rebuilding a website everytime a file or folder has changed:

    nodeache dev folder
    
Publishing a website via FTP:

    nodeache publish folder
    
Where folder is a folder following the structure given under *Folder structure*.

Folder structure
----------------

    folder
    |-  (config.json)
    |-  content
    '-  templates
