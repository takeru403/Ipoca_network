#!/bin/bash
yum update -y
yum install -y python3 git
pip3 install --upgrade pip
pip3 install flask gunicorn

mkdir -p /home/ec2-user/app
cd /home/ec2-user/app

echo 'from flask import Flask
app = Flask(__name__)
@app.route("/")
def hello():
    return "Hello from Flask on EC2!"' > app.py

gunicorn -b 0.0.0.0:80 app:app --daemon

