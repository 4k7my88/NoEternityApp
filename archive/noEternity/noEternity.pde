
CLASS jaeeun;

float firstvalue;        
float secondvalue;             
float thirdvalue;   
float fourthvalue;

PFont f;


void setup(){
 background(0);
 size(displayWidth,displayHeight);
 noStroke(); 
 jaeeun = new CLASS();
 
 f = loadFont( "Serif.plain-48.vlw" );
 // f2 = loadFont( "Serif-90.vlw");
  
}


void draw(){
  
  textFont(f);
  fill(0);
  text("no Eternity", displayWidth/7, displayHeight/3);
 
  one();
  if(thirdvalue > 0){
   jaeeun.display();
  }
  if(fourthvalue > 0){
   //PImage img = loadImage("1.gif");  
  // image(img, 0, 0);
   jaeeun.display();
  }
    
}
void one(){
for(int i=0; i<10000; i+=10){
   fill(random(10,555),random(10,555),mouseX,40);
   ellipse(i,mouseY,30,30);
  }  
}