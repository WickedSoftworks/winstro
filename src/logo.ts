import gradient from "gradient-string";

export const logo = gradient(["#473b7b", "#3584a7", "#30d2be"]).multiline(`
           _           _             
          (_)         | |            
 __      ___ _ __  ___| |_ _ __ ___  
 \\ \\ /\\ / / | '_ \\/ __| __| '__/ _ \\ 
  \\ V  V /| | | | \\__ \\ |_| | | (_) |
   \\_/\\_/ |_|_| |_|___/\\__|_|  \\___/ v1.0-interactive
`);

export const headless_logo = gradient([
	"#473b7b",
	"#3584a7",
	"#30d2be",
]).multiline(`
           _           _             
          (_)         | |            
 __      ___ _ __  ___| |_ _ __ ___  
 \\ \\ /\\ / / | '_ \\/ __| __| '__/ _ \\ 
  \\ V  V /| | | | \\__ \\ |_| | | (_) |
   \\_/\\_/ |_|_| |_|___/\\__|_|  \\___/ v1.0-headless
`);

export const write_logo = gradient([
	"#473b7b",
	"#3584a7",
	"#30d2be",
]).multiline(`
           _           _             
          (_)         | |            
 __      ___ _ __  ___| |_ _ __ ___  
 \\ \\ /\\ / / | '_ \\/ __| __| '__/ _ \\ 
  \\ V  V /| | | | \\__ \\ |_| | | (_) |
   \\_/\\_/ |_|_| |_|___/\\__|_|  \\___/ v1.0-interactive || --qwrite
`);
