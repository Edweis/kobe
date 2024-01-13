set -e

USER=ubuntu
SERVER=ssh.garnet.center
DIR=/home/ubuntu/kobe/


echo "\n🚀 Send to server"
rsync -ravzh --exclude='node_modules' --exclude='database.db'  . $USER@$SERVER:$DIR 

echo "\n🚀 Download dependencies"
ssh -t $USER@$SERVER "cd kobe ; pnpm install --prod"

echo "\n🏃🏻‍♂️ Restart nginx" # sudo ln -s /home/ubuntu/kobe/nginx.conf /etc/nginx/conf.d/kobe.conf # Make sure the symlink exists 
ssh $USER@$SERVER "sudo nginx -t && sudo nginx -s reload"

echo "\n🏃🏻‍♂️ Restart kobe"
ssh $USER@$SERVER pm2 reload kobe 


# View logs with
# ssh ubuntu@ssh.garnet.center tail -f /home/edweis/.pm2/logs/api2-logs.log


## Starting  pm2 for the first time
# NODE_ENV=production pm2 start ./src/index.js \
#     --name kobe --time \
#     -o $HOME/.pm2/logs/kobe-logs.log -e $HOME/.pm2/logs/kobe-logs.log
# pm2 save