import {validationResult} from 'express-validator'

const validate = (req,res,next) =>{
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        const extractError = errors.array().map((err)=>({
            field: err.param,
            message: err.msg
        }))

        return res.status(422).json({
            errors: extractError
        });
    }

    next();
}

export default validate;