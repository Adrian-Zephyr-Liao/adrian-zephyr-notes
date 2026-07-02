import { cn } from "@/lib/utils";
import styles from "./guestbook-effects.module.css";

const twinkleStars = [
  "left-[7%] top-[14%] size-1 [animation-delay:0.1s]",
  "left-[10%] top-[28%] size-0.5 [animation-delay:2.2s]",
  "left-[15%] top-[42%] size-1.5 [animation-delay:1.7s]",
  "left-[18%] top-[9%] size-1 [animation-delay:3.1s]",
  "left-[23%] top-[18%] size-1 [animation-delay:0.9s]",
  "left-[27%] top-[52%] size-0.5 [animation-delay:4.4s]",
  "left-[31%] top-[66%] size-1 [animation-delay:2.4s]",
  "left-[36%] top-[38%] size-1 [animation-delay:0.3s]",
  "left-[41%] top-[27%] size-1.5 [animation-delay:1.1s]",
  "left-[45%] top-[76%] size-1 [animation-delay:3.7s]",
  "left-[52%] top-[12%] size-1 [animation-delay:3.2s]",
  "left-[55%] top-[44%] size-0.5 [animation-delay:1.4s]",
  "left-[61%] top-[58%] size-1.5 [animation-delay:0.4s]",
  "left-[64%] top-[24%] size-1 [animation-delay:5.1s]",
  "left-[69%] top-[72%] size-0.5 [animation-delay:2.9s]",
  "left-[74%] top-[22%] size-1 [animation-delay:2.8s]",
  "left-[79%] top-[8%] size-1.5 [animation-delay:4.8s]",
  "left-[83%] top-[48%] size-1.5 [animation-delay:1.9s]",
  "left-[87%] top-[67%] size-1 [animation-delay:0.8s]",
  "left-[92%] top-[16%] size-1 [animation-delay:0.7s]",
  "left-[95%] top-[36%] size-0.5 [animation-delay:3.5s]",
  "left-[6%] top-[76%] size-1 [animation-delay:5.7s]",
  "left-[21%] top-[84%] size-1.5 [animation-delay:4.1s]",
  "left-[39%] top-[7%] size-0.5 [animation-delay:2.6s]",
  "left-[58%] top-[86%] size-1 [animation-delay:1.2s]",
  "left-[72%] top-[41%] size-0.5 [animation-delay:6.2s]",
  "left-[88%] top-[83%] size-1 [animation-delay:2.1s]",
  "left-[97%] top-[62%] size-1.5 [animation-delay:5.3s]",
];

const meteors = [
  "left-[82%] top-[9%] w-36 [--meteor-angle:-28deg] [--meteor-distance:42rem] [--meteor-duration:5.2s] [--meteor-fall:15rem] [animation-delay:0.2s]",
  "left-[67%] top-[18%] w-28 [--meteor-angle:-31deg] [--meteor-distance:34rem] [--meteor-duration:6.4s] [--meteor-fall:12rem] [animation-delay:1.4s]",
  "left-[94%] top-[31%] w-32 [--meteor-angle:-27deg] [--meteor-distance:46rem] [--meteor-duration:5.9s] [--meteor-fall:17rem] [animation-delay:2.1s]",
  "left-[48%] top-[6%] w-24 [--meteor-angle:-30deg] [--meteor-distance:28rem] [--meteor-duration:7.1s] [--meteor-fall:10rem] [animation-delay:2.9s]",
  "left-[76%] top-[58%] w-28 [--meteor-angle:-25deg] [--meteor-distance:36rem] [--meteor-duration:6.8s] [--meteor-fall:12rem] [animation-delay:3.8s]",
  "left-[58%] top-[35%] w-22 [--meteor-angle:-33deg] [--meteor-distance:32rem] [--meteor-duration:7.6s] [--meteor-fall:13rem] [animation-delay:4.6s]",
  "left-[101%] top-[4%] w-40 [--meteor-angle:-29deg] [--meteor-distance:54rem] [--meteor-duration:6.1s] [--meteor-fall:19rem] [animation-delay:5.5s]",
  "left-[38%] top-[22%] w-20 [--meteor-angle:-24deg] [--meteor-distance:26rem] [--meteor-duration:8.2s] [--meteor-fall:9rem] [animation-delay:6.3s]",
  "left-[90%] top-[72%] w-30 [--meteor-angle:-32deg] [--meteor-distance:42rem] [--meteor-duration:7.3s] [--meteor-fall:16rem] [animation-delay:7.1s]",
  "left-[71%] top-[2%] w-24 [--meteor-angle:-26deg] [--meteor-distance:30rem] [--meteor-duration:6.9s] [--meteor-fall:11rem] [animation-delay:7.9s]",
  "left-[56%] top-[80%] w-18 [--meteor-angle:-29deg] [--meteor-distance:28rem] [--meteor-duration:8.8s] [--meteor-fall:10rem] [animation-delay:8.6s]",
  "left-[97%] top-[46%] w-34 [--meteor-angle:-28deg] [--meteor-distance:48rem] [--meteor-duration:6.5s] [--meteor-fall:18rem] [animation-delay:9.4s]",
];

function GuestbookMeteorShower() {
  return (
    <div
      aria-hidden="true"
      className={cn(styles.meteorSky, "pointer-events-none fixed inset-0 z-0 overflow-hidden")}
    >
      <div className={cn(styles.starField, "absolute inset-0")} />
      <div className={cn(styles.skyVignette, "absolute inset-0")} />

      {twinkleStars.map((className) => (
        <span
          key={className}
          className={cn(
            styles.twinkleStar,
            "absolute rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.82)]",
            className,
          )}
        />
      ))}

      {meteors.map((className) => (
        <span
          key={className}
          className={cn(styles.meteor, "absolute h-px origin-right rounded-full", className)}
        />
      ))}
    </div>
  );
}

export { GuestbookMeteorShower };
