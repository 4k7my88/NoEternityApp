class CLASS { 
  float a =10;
  float angle=0.1;
  CLASS() { 
  }
  void display() {
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

