<div align="center">
  <h1>Chess.com AutoPlayer</h1>
  <p>Automate Chess.com games with a very human-playing neural network that adapts to their opponents ELO. Designed for complete automation, account management, and to ruin children's days.</p>
  <p>Uses the <a href="https://maiachess.com">Maia 3</a> Chess engine for gameplay. Scales between <b>600</b>-<b>2,400</b> (IM) ELO.</p>
</div>

> [!TIP]
> **[1]** Store your account information in the **`.env`** file. **[2]** You should also keep in mind that this is NOT undetected as of right now, and the Chess.com provided will get banned _if_ used for too long in one session.

> _Ensure the account stored is registered to [Chess.com](https://chess.com/) first._

## Preview

<details>
  <summary>
    Open Maia 3 preview. <b>*</b><i>Includes audio</i>. (Muted by default)
  </summary><br>
  <video src="https://github.com/user-attachments/assets/9354f3bf-d76f-4366-b1e8-7310557fadc1"/>
</details>

> Maia 3 is playing at around a **1,600** ELO skill-level.

---

## Using the Auto Player

- To use the autoplayer, ensure you have the [Bun runtime](https://bun.com) installed on your machine.

- Then, install any dependencies using the command:
```
bun install
```

- **_Finally_**, start the server and launch the app using:
```
bun run app
```

---

## Self-diagnosing and Resolving App Problems

### _[1]_ Dealing with Account Bans

If the Chess.com account provided gets suspended, you'll be able to tell because games will not automatically start. If you're unsure, open the **`./app/server.ts`** file, find where it says: **`{ debug: false }`** and set the value to **`true`**.

Debug mode makes the previously headless browser visible, where you'll then be able to see if the account is suspended or not.

### _[2]_ Dealing with Port Issues

If you are constantly opening and closing the app, it's very likely you'll run into issues with the server's port. If it brings up a message, such as "_**Is the port already in use?**_", you can change the port in the **`.env`** file to something it hasn't been set to previously. (Or kill the process using up that port!)
