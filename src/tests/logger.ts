import { createTaskLogger } from "../util/logging";

const tl = createTaskLogger("testLogger");

tl.log("This is a test log message.", "green");
