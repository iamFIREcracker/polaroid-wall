import React, { Component } from 'react';
import Textfit from 'react-textfit';
import Masonry from 'react-masonry-component';
import './Gallery.css';


class Gallery extends Component {
  render() {
    var childElements = this.props.elements.map(function(element, id){
      return (
        <div key={id} className="PolaroidWrapper">
          <div className="Polaroid">
            <div className="ImageWrapper">
              <img alt="" src={element.src} />
            </div>
            <Textfit mode="multi" className="Text">
              {element.title}
            </Textfit>
          </div>
        </div>
      );
    });

    return (
      <Masonry
        className={'Gallery'} // default ''
        disableImagesLoaded={false} // default false
        updateOnEachImageLoad={false} // default false and works only if disableImagesLoaded is false
      >
        {childElements}
      </Masonry>
    );
  }
}

export default Gallery;
