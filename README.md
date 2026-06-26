# HugoCMS

This project aims to make it easier to update the contents of your Hugo website, while merely requiring a Web-Browser on the client device for updating or adding new content.

(Disclaimer: this project is still in an early stage and should be viewed as experimental.)

## Features
* Inbuilt Markdown Editor
* Easy upload functionality
* Ability to preview and deploy the website
* Preview for different Media types

# Installation

Prerequisites:
* podman
* podman-compose
* Make sure to lower the minimum rootless port number as per your requirements (53 or 80)

```bash
git clone git@github.com:HikerScout/HugoCMS.git
cd podman
nano .env # (specify INTERNAL_IP and INTERNAL_FQDN)
./podman-build.sh
./podman-startup.sh
```

You should be up and running.

# Images

<img width="1920" height="1080" alt="02-upload" src="https://github.com/user-attachments/assets/40478cfc-8c89-4202-b925-e5074bbb772b" />
<img width="1920" height="1080" alt="01-editor" src="https://github.com/user-attachments/assets/b95ce9aa-e9d0-4361-a4ed-5a3d71c03ca4" />
