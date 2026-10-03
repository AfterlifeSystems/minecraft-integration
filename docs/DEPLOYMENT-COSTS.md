# Deployment costs (AWS EC2)

What the Minecraft stack in `docker-compose.yml` needs on EC2, and what EC2 costs per month.

> Prices are us-east-1, on-demand, Linux, as of 2026-09-26. The prices come from memory, not a live AWS lookup. Confirm on the [EC2 pricing page](https://aws.amazon.com/ec2/pricing/on-demand/) or the [AWS Pricing Calculator](https://calculator.aws/) before committing.

## What runs on the box

| Service | Role |
|---|---|
| `fabric-server` | Minecraft 1.21.1 on Fabric, Fabric API, Simple Voice Chat. `max-players=8`, view and simulation distance 8. Java heap capped by `JAVA_MEMORY` (default `2G`). |
| `companion` | Node 20 mineflayer bot (`NeuralNexus`). |
| `playit` | playit.gg tunnel agent. Optional on EC2; see [Connecting without playit.gg](#connecting-without-playitgg). |

The Neural Nexus / Anubis backend is **not** part of this stack. The companion calls the backend over HTTP through `NEURAL_NEXUS_API_BASE_URL`, so the LLM, transcription, and embedding work runs elsewhere. No GPU is needed.

## Measured usage

Measured with `docker stats` on 2026-09-26: 30 samples over about one minute, stack up 18 minutes, one human player plus the `NeuralNexus` bot online.

| Container | CPU average / peak (% of one core) | Memory average / peak |
|---|---|---|
| `fabric-server` | 13.7% / 98.3% | 1.19 GB / 1.20 GB |
| `companion` | 2.8% / 9.2% | 121 MB / 132 MB |
| `playit` | 0.2% / 0.6% | 8 MB / 9 MB |
| **Total** | about 0.17 core average | **about 1.3 GB** |

- The world folder on disk is 22 MB.
- The server log shows no `Can't keep up` warnings.
- The CPU peak is a brief spike, likely chunk loading when the player joined.

**Ceiling:** the 2 GB heap cap limits `fabric-server` to about 2.5–2.8 GB of memory. The whole stack tops out around 3 GB.

Re-run the measurement during a longer session with several players before buying a Savings Plan:

```bash
docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' \
  minecraft-integration-fabric-server-1 minecraft-integration-companion-1 minecraft-integration-playit-1
```

## Instance choice

| Instance | vCPU / RAM | $/hour | Instance $/month (730 h) | All-in $/month* | Fit |
|---|---|---|---|---|---|
| **t4g.medium** (recommended) | 2 / 4 GB | $0.0336 | ~$25 | **~$31** | Matches the measured load. |
| t4g.large | 2 / 8 GB | $0.0672 | ~$49 | ~$55 | More headroom; still burstable. |
| m7g.large | 2 / 8 GB | $0.0816 | ~$60 | ~$66 | Full CPU all the time, no credits. |
| m7i.large | 2 / 8 GB | $0.1008 | ~$74 | ~$80 | x86, if an image turns out to need amd64. |

\* All-in adds about $2–3 for EBS storage and $3.65 for the public IPv4 address (see [Other monthly costs](#other-monthly-costs)).

**Why t4g.medium:** the t4g.medium baseline is 20% per vCPU. The measured 13.7% of one core is about 7% of a 2-vCPU instance, so the instance earns CPU credits between spikes. A spike to a full core uses about 49% of the instance and spends a few credits. Turn on **unlimited** credit mode so a busy session never slows down when the credits run out.

**Graviton (the `g` instances) runs ARM.** The `eclipse-temurin`, `node`, and `playit-agent` images publish ARM builds.

**Move up to an 8 GB instance when:**

- `JAVA_MEMORY` goes above `2G`
- heavier mods are added
- several players regularly explore new terrain at once, which keeps the CPU near a full core

**Savings:** a 1-year Savings Plan cuts instance cost by roughly 30–40%, so t4g.medium comes to about $20/month all-in. Stopping the instance when nobody plays cuts instance cost to the hours used; storage and an Elastic IP still bill.

## Other monthly costs

| Item | Cost |
|---|---|
| EBS gp3 volume, 20–30 GB | $0.08 per GB-month, about $2–3 |
| Public IPv4 address | $0.005/hour, about $3.65 (details below) |
| Data transfer out | First 100 GB/month free, then $0.09/GB. Voice chat is the main source of outbound traffic; a small group likely stays near the free tier. |

### Public IPv4 address

Since February 2024, AWS bills **every** public IPv4 address at $0.005/hour, about $3.65/month, Elastic IPs included.

- **Elastic IP:** billed all the time the Elastic IP is allocated, attached or not, including while the instance is stopped. The address never changes.
- **Auto-assigned public IP:** billed only while the instance runs, but the address changes on every start. Players need the new address each time, unless a DNS record updates on boot.
- **Free tier:** older accounts on the 12-month free tier get 750 hours/month of public IPv4 free, which covers one address. Newer accounts use a credit-based free plan instead. Check the account's Billing page.
- **IPv6:** free, but many home networks lack working IPv6. Keep IPv4 for a game server.

For a 24/7 server the Elastic IP costs the same as an auto-assigned IP and never changes, so use an Elastic IP. For an instance that sits stopped for long stretches, an auto-assigned IP saves up to $3.65/month.

## Connecting without playit.gg

On EC2, players connect straight to the instance's public IP, so the playit tunnel is optional. Four steps: give the instance a fixed address, open the firewall, start the stack without playit, then verify.

Steps 1 and 2 show both the AWS console and the AWS CLI. The CLI commands assume the AWS CLI v2 is configured (`aws configure`) for the instance's region.

### 1. Attach an Elastic IP

An Elastic IP keeps the address the same across instance stops and starts. Cost: about $3.65/month (see [Public IPv4 address](#public-ipv4-address)).

**Console:**

1. Open **EC2 → Network & Security → Elastic IPs → Allocate Elastic IP address**. Keep the defaults, then choose **Allocate**.
2. Select the new address, then choose **Actions → Associate Elastic IP address**.
3. Set **Resource type** to **Instance**, pick the Minecraft instance, then choose **Associate**.
4. Copy the **Allocated IPv4 address**. Players join with that address.

**CLI:**

```bash
instance_identifier=i-0123456789abcdef0   # replace with the Minecraft instance

allocation_identifier=$(aws ec2 allocate-address --domain vpc \
  --query AllocationId --output text)

aws ec2 associate-address \
  --instance-id "$instance_identifier" \
  --allocation-id "$allocation_identifier"

aws ec2 describe-addresses --allocation-ids "$allocation_identifier" \
  --query 'Addresses[0].PublicIp' --output text
```

The last command prints the Elastic IP. The SSH session on the old public IP drops when the Elastic IP attaches; reconnect with the Elastic IP.

**Optional DNS name:** create an A record, for example `mc.yourdomain.com`, pointing at the Elastic IP. Players can then type the DNS name instead of the address.

**Later cleanup:** releasing an Elastic IP stops the charge. Disassociate first, then release:

```bash
aws ec2 disassociate-address --association-id "$(aws ec2 describe-addresses \
  --allocation-ids "$allocation_identifier" --query 'Addresses[0].AssociationId' --output text)"
aws ec2 release-address --allocation-id "$allocation_identifier"
```

### 2. Open the firewall (TCP 25565, UDP 24454)

Opening two inbound ports in the instance's security group is all players need to connect.

| Port | Protocol | Used by |
|---|---|---|
| 25565 | TCP | Minecraft join |
| 24454 | UDP | Simple Voice Chat |

Simple Voice Chat only uses UDP on 24454. The `24454:24454/tcp` mapping in `docker-compose.yml` does no harm but needs no rule. Keep the existing SSH rule (TCP 22) so the instance stays reachable.

**Console:**

1. Open **EC2 → Instances**, select the Minecraft instance, open the **Security** tab, then open the security group link.
2. Choose **Edit inbound rules → Add rule**, and add two rules:
   - **Type** Custom TCP, **Port range** `25565`, **Source** Anywhere-IPv4 (`0.0.0.0/0`), **Description** `Minecraft`
   - **Type** Custom UDP, **Port range** `24454`, **Source** Anywhere-IPv4 (`0.0.0.0/0`), **Description** `Voice chat`
3. Choose **Save rules**. Security group rules apply at once; no restart is needed.

**CLI:**

```bash
security_group_identifier=$(aws ec2 describe-instances \
  --instance-ids "$instance_identifier" \
  --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' --output text)

aws ec2 authorize-security-group-ingress \
  --group-id "$security_group_identifier" \
  --ip-permissions \
    "IpProtocol=tcp,FromPort=25565,ToPort=25565,IpRanges=[{CidrIp=0.0.0.0/0,Description=Minecraft}]" \
    "IpProtocol=udp,FromPort=24454,ToPort=24454,IpRanges=[{CidrIp=0.0.0.0/0,Description=VoiceChat}]"
```

To close the ports later, run the same command with `revoke-security-group-ingress` in place of `authorize-security-group-ingress`.

**Host firewall on the instance:** Amazon Linux 2023 has no host firewall enabled by default, and Ubuntu ships `ufw` inactive, so the security group is the only firewall to set. Docker publishes container ports through Docker's own iptables rules, which skip `ufw`, so an active `ufw` needs no extra rules for the Minecraft ports.

#### Optional: allow only known players

`0.0.0.0/0` lets anyone on the internet reach the server. Because the server runs `online-mode=false` (see [Lock the server down](#lock-the-server-down)), the security group can instead list each player's home IP. Each player can find a home IP at <https://checkip.amazonaws.com>. Use `/32` for a single address, for example `203.0.113.10/32`, in place of `0.0.0.0/0` in the rules above, one pair of rules per player. Home IPs change now and then, so a player who suddenly cannot connect may need an updated rule.

### 3. Start the server without playit

From the repository folder on the instance:

1. **Clear `VOICE_HOST`.** With an empty `voice_host`, Simple Voice Chat tells each client to connect to the same address the player joined with, which works for a direct connection. In `.env`, set:

   ```bash
   VOICE_HOST=
   ```

   The entrypoint only rewrites `voice_host` when `VOICE_HOST` has a value, so an old playit hostname saved in the `fabric-config` volume stays until cleared. Clear the saved hostname once:

   ```bash
   docker compose run --rm --no-deps --entrypoint \
     sed fabric-server -i 's/^voice_host=.*/voice_host=/' /minecraft/config/voicechat/voicechat-server.properties
   ```

   Setting `VOICE_HOST` to the Elastic IP also works, and skips the `sed` step.

2. **Stop and remove any running playit container:**

   ```bash
   docker compose stop playit
   docker compose rm -f playit
   ```

3. **Start only the server and the companion:**

   ```bash
   docker compose up --build -d fabric-server companion
   ```

   Naming the services leaves playit out. A bare `docker compose up -d` starts playit again, and with an empty `PLAYIT_SECRET_KEY` the playit container restarts in a loop. To make the change permanent, delete the `playit` block from `docker-compose.yml`, or comment the block out like the `ngrok` block.

4. **Check the containers:**

   ```bash
   docker compose ps
   docker compose logs fabric-server | grep -Ei "Done \(|voice"
   ```

   `fabric-server` should show `healthy`, and the log should show a `Done (...)! For help, type "help"` line.

### 4. Verify from a player's machine

1. **Minecraft port:** from any machine outside AWS:

   ```bash
   nc -vz <elastic-ip> 25565
   ```

   `succeeded` or `open` means the TCP rule works. A timeout means the security group rule is missing.
2. **Join:** in Minecraft, **Multiplayer → Add Server**, enter the Elastic IP or the DNS name. No port is needed; 25565 is the default.
3. **Voice:** after joining, the Simple Voice Chat icon should show connected. A crossed-out icon means UDP 24454 is blocked or `voice_host` still holds an old playit hostname. UDP cannot be tested reliably with `nc`, so the in-game icon is the test.

### Lock the server down

`server/server.properties.example` sets `online-mode=false`, which the bot's offline login needs. With `online-mode=false`, anyone who reaches port 25565 can join under any username, including an operator's name. Opening the ports is enough for players to connect. To keep strangers out, add one or both of the following:

- **Restrict the security group source** to the players' IP addresses, as in [Optional: allow only known players](#optional-allow-only-known-players). The bot connects over the internal Docker network (`fabric-server:25565`), so the restriction does not affect the bot.
- **Enable the whitelist:** set `white-list=true` and `enforce-whitelist=true`, then run `whitelist add <name>` for each player and for `NeuralNexus`. Weaker: in offline mode, anyone can still type a whitelisted name.

### Home hosting instead of EC2

Same steps, with two changes: forward TCP 25565 and UDP 24454 on the router to the host machine in place of steps 1 and 2, and use a dynamic DNS name (for example DuckDNS) instead of an Elastic IP. More options in [PUBLIC-ACCESS.md](PUBLIC-ACCESS.md).

## Hosting the Anubis backend on the same box

The numbers above cover only the Minecraft stack. At idle on 2026-09-26, the Anubis production stack measured:

- `langgraph-api-prod`: about 2.17 GB
- postgres, redis, grafana, and prometheus together: about 0.4 GB
- total: about 2.6 GB

Media uploads run torch and demucs audio processing, which spikes well above idle. Size a combined host at 8 GB or more, for example m7i.large, or t4g.large if the backend image builds for ARM.
