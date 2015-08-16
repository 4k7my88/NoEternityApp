package processing.test.noeternity;

import processing.core.*; 
import processing.data.*; 
import processing.event.*; 
import processing.opengl.*; 

import java.util.HashMap; 
import java.util.ArrayList; 
import java.io.File; 
import java.io.BufferedReader; 
import java.io.PrintWriter; 
import java.io.InputStream; 
import java.io.OutputStream; 
import java.io.IOException; 

public class noEternity extends PApplet {

class CLASS { 
  float a =10;
  float angle=0.1f;
  CLASS() { 
  }
  public void display() {
  filter(BLUR);
  for(int i=5;i<270;i+=2){
  translate(i,100);
  rotate(sin(a));
  a += angle;  
  for(int j=100; j<270; j+=2){
      fill(0);
      rect(random(500),i,5,5);
  }
  }
  }
}


/*
import processing.video.*;
MovieMaker mm;
*/
//import processing.serial.*;     // import the Processing serial library
//Serial myPort;                  // The serial port

CLASS jaeeun;

float firstvalue;        
float secondvalue;             
float thirdvalue;   
float fourthvalue;

public void setup(){
 background(0);

 noStroke(); 
 jaeeun = new CLASS();
 //PImage img = loadImage("1.png"); 
}
 //PImage img = loadImage("1.png");  
 //image(img, width/2,height/2);
//   mm = new MovieMaker(this, width, height, "drawing.mov");
//  println(Serial.list());
//  myPort = new Serial(this, Serial.list()[0], 9600);
//  myPort.bufferUntil('*');

public void draw(){
  one();
  if(thirdvalue > 0){
   jaeeun.display();
  }
  if(fourthvalue > 0){
   //PImage img = loadImage("1.gif");  
  // image(img, 0, 0);
   jaeeun.display();
  }
    //mm.addFrame();
}
public void one(){
for(int i=0; i<10000; i+=10){
   fill(random(10,555),random(10,555),mouseX,40);
   ellipse(i,mouseY,30,30);
  }  
}/*
void serialEvent(Serial myPort) { 

  String myString = myPort.readStringUntil('*');
 
  if (myString != null) {

    int[] sensors = int(splitTokens(myString, ",*"));

    for (int sensorNum = 0; sensorNum < sensors.length; sensorNum++) {
      print("Sensor " + sensorNum + ": " + sensors[sensorNum] + "     "); 
    }
    println();
    firstvalue=map(sensors[0],0,1023,0,width);
    secondvalue = map(sensors[1], 0,1023,0,height);
    thirdvalue = sensors[2];
    fourthvalue =sensors[3];
  }
}
/*
void keyPressed() {
  if (key == ' ') {
    // Finish the movie if space bar is pressed
  mm.finish();
    // Quit running the sketch once the file is written
exit();
  }
}
*/


  public int sketchWidth() { return displayWidth; }
  public int sketchHeight() { return displayHeight; }
}
