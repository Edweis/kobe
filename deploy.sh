set -e

PROJECT=kobe
USER=lipp
SERVER=lipp.local 
PORT=6602



echo "\n🚀 Send to server"
rsync -ravzh --filter=':- .gitignore'  . $USER@$SERVER:/home/$USER/projects/$PROJECT/

echo "\n🚀 Download dependencies"
ssh $USER@$SERVER "cd projects/$PROJECT ; pnpm install --prod"

echo "\n🏃🏻‍♂️ Restart nginx" # sudo ln -s /home/ubuntu/kobe/nginx.conf /etc/nginx/conf.d/kobe.conf # Make sure the symlink exists 
ssh $USER@$SERVER "sudo nginx -t && sudo nginx -s reload"


## Starting  pm2 for the first time
ssh $USER@$SERVER "\
  cd projects/$PROJECT ; \
  NODE_ENV=production PORT=$PORT pm2 \
    start ./src/index.js \
    --name $PROJECT --time \
    -o /home/$USER/.pm2/logs/$PROJECT-logs.log \
    -e /home/$USER/.pm2/logs/$PROJECT-logs.log \
  || pm2 reload $PROJECT"

# pm2 save