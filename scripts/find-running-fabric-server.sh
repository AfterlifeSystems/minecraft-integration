pgrep -af 'fabric-server-launch.jar|net.fabricmc' || echo 'no fabric process'
    ss -ltn | grep 25565 || echo '25565 not listening'