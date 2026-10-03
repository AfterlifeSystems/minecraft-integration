1. Stop the playit agent on the home machine (docker compose stop playit), or shut down the whole stack there. Run only one agent per secret key. I haven't tested what playit does when two agents use the same key at once.
2. On EC2, clone the repo and copy these values from your home .env without changing them:
   - PLAYIT_SECRET_KEY: same agent, same tunnels.
   - VOICE_HOST: the same playit UDP hostname:port.
   - API_KEY and ASSISTANT_ID.
3. Check NEURAL_NEXUS_API_BASE_URL. If it's set to http://host.docker.internal:8124 at home, that won't work on EC2. Change it to https://api.neuralnexus.site.
4. Optional: to keep the same world, copy the world folder from the home server to the instance. The docs list the world folder at 22 MB.
5. Run docker compose upminecraft-integrationng when the log showsplayit connected; tun=2.